import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { templateBase64, faceBase64 } = await req.json();

        if (!templateBase64 || !faceBase64) {
            return NextResponse.json({ error: 'Missing images' }, { status: 400 });
        }

        const response = await fetch('https://fal.run/fal-ai/face-swap', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${process.env.FAL_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                base_image_url: templateBase64,
                swap_image_url: faceBase64,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Fal API error:", err);
            return NextResponse.json({ error: 'Failed to generate image' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ imageUrl: data.image.url });

    } catch (error) {
        console.error('Error generating image:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
