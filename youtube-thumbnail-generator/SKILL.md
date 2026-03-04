---
name: youtube-thumbnail-generator
description: Creates custom YouTube thumbnails by swapping a user's face onto example templates using the native Nano Banana Pro image generation capabilities. Use when the user requests a YouTube thumbnail, provides face images, and a template to swap faces into.
---

# YouTube Thumbnail Face Swap Creator

## When to use this skill
- The user asks to generate or recreate a YouTube thumbnail combining a template and their face.
- The user provides images of their face and an example thumbnail template.
- The user wants to perform a face swap for a thumbnail.

## Workflow
1. **Gather Images**: Confirm you have the user's face image(s) and the target thumbnail template image.
2. **Formulate Prompt**: Construct a highly specific prompt for the `generate_image` tool to replace the person's face in the template thumbnail with the user's face while retaining the exact template layout and style.
3. **Execute Face Swap**: Call the `generate_image` tool, passing the user face image(s) and the target thumbnail in the `ImagePaths` array.
4. **Present Result**: Show the generated image artifact to the user via markdown formatting.

## Instructions
- Ensure you have the `generate_image` tool available. **Nano Banana Pro is the primary engine powering your native generate_image tool.** Therefore, you do not need external API keys.
- You can accept up to 3 images in `ImagePaths`. Pass at least one clear image of the user's face and the original thumbnail template.
- **Prompt Formulation:** The prompt must explicitly instruct the model to perform a face-swap while preserving the scene perfectly. 
  *Example*: `"Using the provided thumbnail scene as an exact template (maintaining layout, text, background, and style), replace the subject's face with the face from the provided reference image(s). Ensure lighting and expression match the original thumbnail's vibe perfectly."`
- **Output Name**: Set `ImageName` systematically, e.g., `youtube_thumbnail_faceswap`.

## Resources
- Native `generate_image` tool (powered by Nano Banana Pro). No external API keys or tokens are required.
