package `in`.onesaas.attendance.zwitch

import android.app.Activity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.open.open_web_sdk.OpenPayment
import com.open.open_web_sdk.listener.PaymentStatusListener
import com.open.open_web_sdk.model.TransactionDetails

class ZwitchPaymentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), PaymentStatusListener {

  private var openPayment: OpenPayment? = null
  private var pendingPromise: Promise? = null

  override fun getName(): String = NAME

  @ReactMethod
  fun startPayment(
      paymentToken: String,
      accessKey: String,
      environment: String,
      colorPrimary: String?,
      promise: Promise,
  ) {
    val token = paymentToken.trim()
    val key = accessKey.trim()
    if (token.isEmpty()) {
      promise.reject(ERROR_CODE, "Payment token is required.")
      return
    }
    if (key.isEmpty()) {
      promise.reject(ERROR_CODE, "Zwitch access key is not configured.")
      return
    }
    if (pendingPromise != null) {
      promise.reject(ERROR_CODE, "A payment is already in progress.")
      return
    }

    val activity: Activity? = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(ERROR_CODE, "No active screen to open payment.")
      return
    }

    pendingPromise = promise

    UiThreadUtil.runOnUiThread {
      try {
        val env =
            when (environment.trim().lowercase()) {
              "live", "production" -> OpenPayment.Environment.LIVE
              else -> OpenPayment.Environment.SANDBOX
            }

        val builder =
            OpenPayment.Builder()
                .with(activity)
                .setPaymentToken(token)
                .setEnvironment(env)
                .setAccessKey(key)

        val primary = colorPrimary?.trim().orEmpty()
        if (primary.isNotEmpty()) {
          builder.setColorPrimary(primary)
        }

        if (COMPANY_LOGO_URL.isNotEmpty()) {
          builder.setCompanyLogo(COMPANY_LOGO_URL)
        }
        builder.setErrorColor(ERROR_THEME_COLOR)

        val payment = builder.build()
        openPayment = payment
        payment.setPaymentStatusListener(this)
        payment.startPayment()
      } catch (e: Throwable) {
        val detail =
            listOfNotNull(
                    e.message?.trim()?.takeIf { it.isNotEmpty() },
                    e.javaClass.simpleName.takeIf { it.isNotEmpty() },
                )
                .joinToString(": ")
        failPending(
            promise,
            detail.ifBlank { "Could not start payment." },
            if (e is Exception) e else Exception(e),
        )
      }
    }
  }

  override fun onTransactionCompleted(transactionDetails: TransactionDetails) {
    UiThreadUtil.runOnUiThread {
      if (pendingPromise == null) {
        detachPayment()
      } else {
        try {
          val result =
              Arguments.createMap().apply {
                putString("paymentId", transactionDetails.paymentId.orEmpty())
                putString("paymentTokenId", transactionDetails.paymentTokenId.orEmpty())
                putString("status", transactionDetails.status.orEmpty())
              }
          resolvePending { it.resolve(result) }
        } catch (e: Throwable) {
          val promise = pendingPromise
          if (promise != null) {
            failPending(
                promise,
                e.message ?: "Payment completed but the result could not be read.",
                if (e is Exception) e else Exception(e),
            )
          } else {
            detachPayment()
          }
        }
      }
    }
  }

  override fun onError(message: String) {
    UiThreadUtil.runOnUiThread {
      val promise = pendingPromise
      if (promise == null) {
        detachPayment()
      } else {
        failPending(promise, message.ifBlank { "Payment error." })
      }
    }
  }

  private fun resolvePending(block: (Promise) -> Unit) {
    val promise = pendingPromise ?: return
    pendingPromise = null
    detachPayment()
    block(promise)
  }

  private fun failPending(promise: Promise, message: String, cause: Throwable? = null) {
    pendingPromise = null
    detachPayment()
    if (cause != null) {
      promise.reject(ERROR_CODE, message, cause)
    } else {
      promise.reject(ERROR_CODE, message)
    }
  }

  private fun detachPayment() {
    try {
      openPayment?.detachListener()
    } catch (_: Exception) {
    }
    openPayment = null
  }

  override fun invalidate() {
    pendingPromise?.reject(ERROR_CODE, "Payment module was destroyed.")
    pendingPromise = null
    detachPayment()
    super.invalidate()
  }

  companion object {
    const val NAME = "ZwitchPayment"
    private const val ERROR_CODE = "ZWITCH_PAYMENT_ERROR"
    private const val COMPANY_LOGO_URL = "https://ooms.in/uploads/ooms/logo.png"
    private const val ERROR_THEME_COLOR = "#ff2b2b"
  }
}
