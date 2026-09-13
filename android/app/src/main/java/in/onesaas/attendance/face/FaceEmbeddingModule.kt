package `in`.onesaas.attendance.face

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Rect
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.File
import java.net.URLDecoder
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import java.nio.charset.StandardCharsets
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import kotlin.math.round
import kotlin.math.sqrt
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter

class FaceEmbeddingModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()
  private val inference = FaceEmbeddingInference(reactApplicationContext)

  override fun getName(): String = NAME

  @ReactMethod
  fun generateEmbedding(path: String, promise: Promise) {
    if (path.isBlank()) {
      promise.reject(ERROR_CODE, "A face image path is required.")
      return
    }

    executor.execute {
      try {
        val embedding = inference.generate(path)
        val result: WritableArray = Arguments.createArray()

        embedding.forEach { value ->
          result.pushDouble(value.toDouble())
        }

        promise.resolve(result)
      } catch (error: Throwable) {
        val actualError = if (error is ExecutionException) error.cause ?: error else error
        promise.reject(
          ERROR_CODE,
          actualError.message ?: "Unable to generate face embedding.",
          actualError,
        )
      }
    }
  }

  override fun invalidate() {
    executor.shutdownNow()
    inference.close()
    super.invalidate()
  }

  companion object {
    const val NAME = "OneAttendanceFaceEmbedding"
    private const val ERROR_CODE = "FACE_EMBEDDING_ERROR"
  }
}

private class FaceEmbeddingInference(
  private val context: ReactApplicationContext,
) {

  private val interpreter: Interpreter by lazy {
    createInterpreter()
  }

  private val faceDetector: FaceDetector by lazy {
    val options = FaceDetectorOptions.Builder()
      .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
      .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
      .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
      .setMinFaceSize(0.15f)
      .build()
    FaceDetection.getClient(options)
  }

  fun generate(path: String): FloatArray {
    val bitmap = decodeBitmap(path)

    return try {
      generateFromBitmap(bitmap)
    } finally {
      bitmap.recycle()
    }
  }

  private fun decodeBitmap(path: String): Bitmap {
    val normalizedPath = normalizeImagePath(path)

    val rawBitmap: Bitmap = if (normalizedPath.startsWith("content://")) {
      val uri = Uri.parse(normalizedPath)
      val inputStream = context.contentResolver.openInputStream(uri)
        ?: error("The captured face image could not be opened from content URI: $uri")

      inputStream.use { stream ->
        BitmapFactory.decodeStream(stream)
          ?: error("The captured face image could not be decoded from content URI: $uri")
      }
    } else {
      val file = File(normalizedPath)
      BitmapFactory.decodeFile(file.absolutePath)
        ?: error("The captured face image could not be decoded from path: $normalizedPath")
    }

    return rotateBitmapIfRequired(rawBitmap, normalizedPath)
  }

  private fun rotateBitmapIfRequired(bitmap: Bitmap, path: String): Bitmap {
    return try {
      val orientation = if (path.startsWith("content://")) {
        val uri = Uri.parse(path)
        context.contentResolver.openInputStream(uri)?.use { stream ->
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val exif = ExifInterface(stream)
            exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
          } else {
            ExifInterface.ORIENTATION_NORMAL
          }
        } ?: ExifInterface.ORIENTATION_NORMAL
      } else {
        val exif = ExifInterface(path)
        exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      }

      val rotationDegrees = when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }

      if (rotationDegrees != 0f) {
        val matrix = Matrix().apply { postRotate(rotationDegrees) }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated !== bitmap) {
          bitmap.recycle()
        }
        rotated
      } else {
        bitmap
      }
    } catch (_: Throwable) {
      bitmap
    }
  }

  private fun normalizeImagePath(path: String): String {
    val trimmed = path.trim()
    if (trimmed.isEmpty()) {
      return trimmed
    }

    return when {
      trimmed.startsWith("content://") -> trimmed
      trimmed.startsWith("file://") -> URLDecoder.decode(
        trimmed.removePrefix("file://"),
        StandardCharsets.UTF_8.name(),
      )
      else -> trimmed
    }
  }

  private fun generateFromBitmap(bitmap: Bitmap): FloatArray {
    // 1. Detect faces using Google ML Kit
    val inputImage = InputImage.fromBitmap(bitmap, 0)
    val faces: List<Face> = try {
      Tasks.await(faceDetector.process(inputImage))
    } catch (e: ExecutionException) {
      throw e.cause ?: e
    }

    if (faces.isEmpty()) {
      error("No face detected in the photo. Please center your face in good lighting.")
    }
    if (faces.size > 1) {
      error("Multiple faces detected (${faces.size}). Only one person should be in frame.")
    }

    val faceBox = faces[0].boundingBox
    val cropped = cropFace(bitmap, faceBox)

    val inputTensor = interpreter.getInputTensor(0)
    val inputShape = inputTensor.shape()

    require(
      inputShape.size == 4 &&
        inputShape[0] == 1 &&
        inputShape[3] == 3,
    ) {
      "Face model input must be [1, height, width, 3]. Actual=${inputShape.contentToString()}"
    }

    val height = inputShape[1]
    val width = inputShape[2]

    require(width > 0 && height > 0) {
      "Invalid face model input dimensions: ${width}x${height}"
    }

    val outputTensor = interpreter.getOutputTensor(0)
    val outputShape = outputTensor.shape()
    val outputSize = outputShape.fold(1) { total, size -> total * size }

    require(outputSize == EMBEDDING_DIMENSION) {
      "Face model output must contain $EMBEDDING_DIMENSION values. " +
        "Actual shape=${outputShape.contentToString()}, " +
        "type=${outputTensor.dataType()}"
    }

    val resized = Bitmap.createScaledBitmap(
      cropped,
      width,
      height,
      true,
    )

    try {
      val inputBuffer = createInputBuffer(inputTensor, width, height)

      fillInputBuffer(
        bitmap = resized,
        buffer = inputBuffer,
        inputTensor = inputTensor,
      )

      inputBuffer.rewind()

      val outputBuffer = createOutputBuffer(outputTensor, outputSize)

      interpreter.run(inputBuffer, outputBuffer)

      outputBuffer.rewind()

      val rawEmbedding = readOutput(
        outputBuffer = outputBuffer,
        outputTensor = outputTensor,
        outputSize = outputSize,
      )

      return normalize(rawEmbedding)
    } finally {
      if (resized !== cropped) {
        resized.recycle()
      }

      if (cropped !== bitmap) {
        cropped.recycle()
      }
    }
  }

  private fun cropFace(bitmap: Bitmap, box: Rect): Bitmap {
    val boxWidth = box.width()
    val boxHeight = box.height()

    require(boxWidth >= 20 && boxHeight >= 20) {
      "The detected face is too small. Please position closer to the camera."
    }

    // 15% margin around the face bounding box to include full facial geometry and jawline
    val marginX = (boxWidth * 0.15f).toInt()
    val marginY = (boxHeight * 0.15f).toInt()

    var left = maxOf(0, box.left - marginX)
    var top = maxOf(0, box.top - marginY)
    var right = minOf(bitmap.width, box.right + marginX)
    var bottom = minOf(bitmap.height, box.bottom + marginY)

    // Make crop square for FaceNet input
    val cropW = right - left
    val cropH = bottom - top
    val side = maxOf(cropW, cropH)

    val centerX = (left + right) / 2
    val centerY = (top + bottom) / 2

    left = maxOf(0, centerX - side / 2)
    top = maxOf(0, centerY - side / 2)
    right = minOf(bitmap.width, left + side)
    bottom = minOf(bitmap.height, top + side)

    // Re-adjust if edges clamped
    if (right - left < side && left > 0) {
      left = maxOf(0, right - side)
    }
    if (bottom - top < side && top > 0) {
      top = maxOf(0, bottom - side)
    }

    val finalW = right - left
    val finalH = bottom - top

    require(finalW > 0 && finalH > 0) {
      "Failed to crop face region from the image."
    }

    return Bitmap.createBitmap(bitmap, left, top, finalW, finalH)
  }

  private fun fillInputBuffer(
    bitmap: Bitmap,
    buffer: ByteBuffer,
    inputTensor: org.tensorflow.lite.Tensor,
  ) {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)

    bitmap.getPixels(
      pixels,
      0,
      width,
      0,
      0,
      width,
      height,
    )

    val inputType = inputTensor.dataType()
    val quantization = inputTensor.quantizationParams()
    val scale = quantization.scale
    val zeroPoint = quantization.zeroPoint

    pixels.forEach { pixel ->
      val red = (pixel shr 16) and 0xff
      val green = (pixel shr 8) and 0xff
      val blue = pixel and 0xff

      writeInputValue(
        buffer = buffer,
        value = red,
        inputType = inputType,
        scale = scale,
        zeroPoint = zeroPoint,
      )

      writeInputValue(
        buffer = buffer,
        value = green,
        inputType = inputType,
        scale = scale,
        zeroPoint = zeroPoint,
      )

      writeInputValue(
        buffer = buffer,
        value = blue,
        inputType = inputType,
        scale = scale,
        zeroPoint = zeroPoint,
      )
    }
  }

  private fun writeInputValue(
    buffer: ByteBuffer,
    value: Int,
    inputType: DataType,
    scale: Float,
    zeroPoint: Int,
  ) {
    when (inputType) {
      DataType.UINT8 -> {
        // For uint8 input with scale=1/255 and zero_point=0, raw pixel 0..255 maps directly.
        // If quantization parameters are provided, map normalized float to quantized int.
        val byteVal = if (scale > 0f) {
          val realVal = if (zeroPoint == 0) {
            value.toFloat() / 255.0f
          } else {
            (value - 127.5f) / 128.0f
          }
          round(realVal / scale + zeroPoint).toInt().coerceIn(0, 255)
        } else {
          value.coerceIn(0, 255)
        }
        buffer.put(byteVal.toByte())
      }

      DataType.FLOAT32 -> {
        val normalized = (value - 127.5f) / 128.0f
        buffer.putFloat(normalized)
      }

      DataType.INT8 -> {
        val normalized = (value - 127.5f) / 128.0f
        val quantized = round(
          normalized / scale + zeroPoint,
        ).toInt()

        buffer.put(
          quantized
            .coerceIn(-128, 127)
            .toByte(),
        )
      }

      else -> {
        error("Unsupported face model input type: $inputType")
      }
    }
  }

  private fun readOutput(
    outputBuffer: ByteBuffer,
    outputTensor: org.tensorflow.lite.Tensor,
    outputSize: Int,
  ): FloatArray {
    val outputType = outputTensor.dataType()
    val quantization = outputTensor.quantizationParams()
    val scale = quantization.scale
    val zeroPoint = quantization.zeroPoint

    return FloatArray(outputSize) {
      when (outputType) {
        DataType.FLOAT32 -> {
          outputBuffer.float
        }

        DataType.UINT8 -> {
          val quantized = outputBuffer.get().toInt() and 0xff
          (quantized - zeroPoint) * scale
        }

        DataType.INT8 -> {
          val quantized = outputBuffer.get().toInt()
          (quantized - zeroPoint) * scale
        }

        else -> {
          error("Unsupported face model output type: $outputType")
        }
      }
    }
  }

  private fun createInputBuffer(
    inputTensor: org.tensorflow.lite.Tensor,
    width: Int,
    height: Int,
  ): ByteBuffer {
    val bytesPerValue = when (inputTensor.dataType()) {
      DataType.FLOAT32 -> 4
      DataType.UINT8,
      DataType.INT8 -> 1
      else -> error(
        "Unsupported face model input type: ${inputTensor.dataType()}",
      )
    }

    return ByteBuffer
      .allocateDirect(width * height * 3 * bytesPerValue)
      .order(ByteOrder.nativeOrder())
  }

  private fun createOutputBuffer(
    outputTensor: org.tensorflow.lite.Tensor,
    outputSize: Int,
  ): ByteBuffer {
    val bytesPerValue = when (outputTensor.dataType()) {
      DataType.FLOAT32 -> 4
      DataType.UINT8,
      DataType.INT8 -> 1
      else -> error(
        "Unsupported face model output type: ${outputTensor.dataType()}",
      )
    }

    return ByteBuffer
      .allocateDirect(outputSize * bytesPerValue)
      .order(ByteOrder.nativeOrder())
  }

  private fun normalize(values: FloatArray): FloatArray {
    var sum = 0.0

    values.forEach { value ->
      require(value.isFinite()) {
        "The face model returned a non-finite embedding value."
      }

      sum += value.toDouble() * value.toDouble()
    }

    val norm = sqrt(sum)

    require(norm.isFinite() && norm > 0.0) {
      "The face model returned an invalid embedding norm."
    }

    return FloatArray(values.size) { index ->
      values[index] / norm.toFloat()
    }
  }

  private fun createInterpreter(): Interpreter {
    val modelBuffer = context.assets.openFd(MODEL_ASSET).use { descriptor ->
      descriptor.createInputStream().use { stream ->
        stream.channel.map(
          FileChannel.MapMode.READ_ONLY,
          descriptor.startOffset,
          descriptor.declaredLength,
        )
      }
    }

    return Interpreter(modelBuffer)
  }

  fun close() {
    try {
      faceDetector.close()
    } catch (_: Throwable) {
    }
    try {
      interpreter.close()
    } catch (_: Throwable) {
    }
  }

  companion object {
    private const val MODEL_ASSET = "face_embedding.tflite"
    private const val EMBEDDING_DIMENSION = 512
  }
}