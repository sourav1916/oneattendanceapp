This directory contains the 512-dimensional FaceNet TFLite model used by the
native embedding bridge. The model is:

facenet512_uint8_float32.tflite (derived from FaceNet512 / NXP)
- Input: [1, 160, 160, 3] UINT8 (raw RGB pixel values [0, 255])
- Output: [1, 512] FLOAT32 (unquantized float embeddings)
- Alignment: Detected and cropped via Google ML Kit Face Detection with 15% margin
- Normalization: L2-normalized on device before transmission

face_embedding.tflite

The model accepts an input shaped [1, 160, 160, 3] UINT8 and returns exactly 512
float values. Enrollment and attendance must use this exact same model file.
Do not substitute a face-detection model; detection does not produce identity embeddings.
