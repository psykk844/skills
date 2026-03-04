import { NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

// Configure fal client with API key
fal.config({
    credentials: process.env.FAL_KEY || '',
});

// The person replacement prompt - replaces entire person while keeping scene
const PERSON_SWAP_PROMPT = `I am providing two images:

- Image 1 is a reference photo of a person (the SOURCE person). This person should appear in the final result.
- Image 2 is a YouTube thumbnail template (the TARGET image). This contains the scene, layout, text, and composition to preserve.

Your task: Generate a new image that keeps the EXACT same scene, layout, background, text, graphics, and composition from Image 2 — but replace the person in Image 2 with the person from Image 1.

Critical requirements:
1. Replace the ENTIRE person - face, head shape, hair, body shape, and clothing should all come from Image 1
2. The person from Image 1 should be wearing their own clothes (from Image 1), NOT the clothes from Image 2
3. Match the pose and position of the original person in Image 2
4. Adapt the lighting on the new person to match the scene
5. Keep ALL text, graphics, background elements, and composition from Image 2 exactly the same
6. The output should be photorealistic and suitable for a professional YouTube thumbnail
7. Maintain the same image dimensions and aspect ratio as Image 2

Generate the person-swapped thumbnail now.`;

// Prompt for iterating/refining an existing result
const getIterationPrompt = (userInstructions: string) => `I am providing two images:

- Image 1 is the current thumbnail that needs refinement
- Image 2 is the reference photo of the person who should appear in the thumbnail

The user wants the following changes made to Image 1:
${userInstructions}

Apply these changes while keeping everything else the same. Maintain all text, graphics, and background elements. Output a refined version of the thumbnail.`;

// Type definitions for fal.ai response
interface FalImage {
    url: string;
    content_type?: string;
    file_name?: string;
    width?: number;
    height?: number;
}

interface FalResult {
    images: FalImage[];
    description?: string;
}

// Helper to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

export async function POST(req: Request) {
    try {
        const { templateBase64, faceBase64, iterationBase64, iterationPrompt } = await req.json();

        // Check if this is an iteration request or initial generation
        const isIteration = !!iterationBase64 && !!iterationPrompt;

        if (!isIteration && (!templateBase64 || !faceBase64)) {
            return NextResponse.json({ error: 'Missing images' }, { status: 400 });
        }

        if (isIteration && (!iterationBase64 || !faceBase64)) {
            return NextResponse.json({ error: 'Missing images for iteration' }, { status: 400 });
        }

        // Check if API key is configured
        if (!process.env.FAL_KEY) {
            return NextResponse.json({ 
                error: 'Fal.ai API key not configured. Please add FAL_KEY to .env.local' 
            }, { status: 500 });
        }

        // Validate image sizes (max 10MB each)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (faceBase64 && faceBase64.length > MAX_SIZE) {
            return NextResponse.json({ 
                error: 'Face image too large. Maximum size is 10MB.' 
            }, { status: 413 });
        }
        if (templateBase64 && templateBase64.length > MAX_SIZE) {
            return NextResponse.json({ 
                error: 'Template image too large. Maximum size is 10MB.' 
            }, { status: 413 });
        }
        if (iterationBase64 && iterationBase64.length > MAX_SIZE) {
            return NextResponse.json({ 
                error: 'Previous result too large. Maximum size is 10MB.' 
            }, { status: 413 });
        }

        console.log(isIteration ? "Starting iteration..." : "Starting Nano Banana 2 person swap via fal.ai...");
        console.log("Face image size:", faceBase64.length, "bytes (base64)");
        if (!isIteration) {
            console.log("Template image size:", templateBase64.length, "bytes (base64)");
        } else {
            console.log("Previous result size:", iterationBase64.length, "bytes (base64)");
            console.log("Iteration prompt:", iterationPrompt);
        }

        try {
            // Upload images to fal.ai storage for better reliability
            console.log("Uploading images to fal.ai storage...");
            
            const faceBlob = base64ToBlob(faceBase64, 'image/jpeg');
            const faceFile = new File([faceBlob], 'face.jpg', { type: 'image/jpeg' });
            
            let imageUrls: string[];
            let prompt: string;
            
            if (isIteration) {
                // For iteration: use previous result + face reference
                const iterationBlob = base64ToBlob(iterationBase64, 'image/png');
                const iterationFile = new File([iterationBlob], 'previous.png', { type: 'image/png' });
                
                const [iterationUrl, faceUrl] = await Promise.all([
                    fal.storage.upload(iterationFile),
                    fal.storage.upload(faceFile)
                ]);
                
                console.log("Previous result uploaded to:", iterationUrl);
                console.log("Face reference uploaded to:", faceUrl);
                
                imageUrls = [iterationUrl, faceUrl];
                prompt = getIterationPrompt(iterationPrompt);
            } else {
                // For initial generation: use face + template
                const templateBlob = base64ToBlob(templateBase64, 'image/jpeg');
                const templateFile = new File([templateBlob], 'template.jpg', { type: 'image/jpeg' });
                
                const [faceUrl, templateUrl] = await Promise.all([
                    fal.storage.upload(faceFile),
                    fal.storage.upload(templateFile)
                ]);
                
                console.log("Face uploaded to:", faceUrl);
                console.log("Template uploaded to:", templateUrl);
                
                imageUrls = [faceUrl, templateUrl];
                prompt = PERSON_SWAP_PROMPT;
            }

            console.log("Calling fal.ai Nano Banana 2 /edit endpoint...");
            
            // Call fal.ai Nano Banana 2 edit endpoint
            const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
                input: {
                    prompt: prompt,
                    image_urls: imageUrls,
                    num_images: 1,
                    output_format: "jpeg", // JPEG is faster than PNG
                    resolution: "1K", // Good balance of speed and quality for thumbnails
                    aspect_ratio: "16:9", // YouTube thumbnail aspect ratio - faster than auto
                    limit_generations: true,
                    sync_mode: true, // Return data directly, skip storage
                },
                logs: false, // Disable logs for slightly faster processing
            });

            console.log("Fal.ai response received");

            const data = result.data as FalResult;

            // Extract the generated image from response
            if (data.images && data.images.length > 0) {
                const imageUrl = data.images[0].url;
                console.log("Success! Generated image URL:", imageUrl);
                
                // Fetch the image and convert to base64 for consistent response format
                const imageResponse = await fetch(imageUrl);
                const imageBuffer = await imageResponse.arrayBuffer();
                const imageBase64 = Buffer.from(imageBuffer).toString('base64');
                
                return NextResponse.json({ 
                    imageBase64: imageBase64,
                    mimeType: data.images[0].content_type || 'image/png',
                    imageUrl: imageUrl, // Also provide URL as fallback
                    message: "Success! Face swap completed using Nano Banana 2 via fal.ai"
                });
            }

            // If we get here, no image was generated
            console.error("No image found in response");
            console.error("Full response:", JSON.stringify(data, null, 2));
            
            return NextResponse.json({ 
                error: 'No image generated. The model may have been unable to process the request.',
                details: 'Try using clearer face photos or simpler templates.'
            }, { status: 500 });

        } catch (apiError: unknown) {
            console.error("Fal.ai API error:", apiError);
            
            const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
            const errorString = apiError instanceof Error ? apiError.toString() : String(apiError);
            
            // Check for specific error types
            if (errorMessage.includes('SAFETY') || errorMessage.includes('safety')) {
                return NextResponse.json({ 
                    error: 'Image was blocked by safety filters. Try different images.',
                    details: errorString
                }, { status: 400 });
            }
            
            if (errorMessage.includes('quota') || errorMessage.includes('rate') || errorMessage.includes('credit')) {
                return NextResponse.json({ 
                    error: 'API rate limit or credits exhausted. Please check your fal.ai account.',
                    details: errorString
                }, { status: 429 });
            }

            if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized')) {
                return NextResponse.json({ 
                    error: 'Invalid fal.ai API key. Please check your FAL_KEY in .env.local',
                    details: errorString
                }, { status: 401 });
            }
            
            return NextResponse.json({ 
                error: `Fal.ai API error: ${errorMessage}`,
                details: errorString
            }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error('Error generating image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('Stack trace:', errorStack);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: errorMessage
        }, { status: 500 });
    }
}
