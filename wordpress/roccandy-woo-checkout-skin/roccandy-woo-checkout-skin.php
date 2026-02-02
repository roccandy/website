<?php
/**
 * Plugin Name: Roc Candy Woo Checkout Skin
 * Description: Styles the WooCommerce Order Pay page and reorders wallet buttons for a cleaner checkout.
 * Version: 0.1.0
 * Author: Roc Candy
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

/**
 * Add a clean "Checkout" heading on order-pay pages.
 */
add_action( 'woocommerce_before_checkout_form', function () {
  if ( function_exists( 'is_checkout' ) && is_checkout() && isset( $_GET['pay_for_order'] ) ) {
    echo '<h1 class="rc-order-pay-title">Checkout</h1>';
  }
}, 1 );

/**
 * Inject CSS + JS only on the Order Pay page.
 */
add_action( 'wp_enqueue_scripts', function () {
  if ( function_exists( 'is_checkout' ) && is_checkout() && isset( $_GET['pay_for_order'] ) ) {
    $css = <<<CSS
body.woocommerce-order-pay .woocommerce {
  max-width: 520px;
  margin: 0 auto;
  text-align: center;
  padding: 24px 16px;
}

body.woocommerce-order-pay .rc-order-pay-title {
  font-size: 22px;
  margin: 10px 0 18px;
}

/* Tighten review table spacing */
body.woocommerce-order-pay .shop_table,
body.woocommerce-order-pay .woocommerce-checkout-review-order-table {
  margin: 0 auto 12px;
}

body.woocommerce-order-pay .shop_table th,
body.woocommerce-order-pay .shop_table td {
  padding: 10px 12px;
}

/* Clean payment list */
body.woocommerce-order-pay #payment .wc_payment_methods {
  display: grid;
  gap: 10px;
  text-align: left;
  margin: 10px auto 0;
  padding: 0;
  max-width: 420px;
}

body.woocommerce-order-pay #payment .wc_payment_method {
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
  cursor: pointer;
  max-width: 420px;
  margin: 0 auto;
}

body.woocommerce-order-pay #payment .wc_payment_method input[type="radio"] {
  position: static;
  opacity: 1;
  margin-right: 8px;
}

body.woocommerce-order-pay #payment .wc_payment_method input:checked + label {
  font-weight: 600;
}

body.woocommerce-order-pay #payment .wc_payment_method label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

body.woocommerce-order-pay #payment .payment_box {
  background: #f7f7f9;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 10px 0 0;
}

/* Wallet buttons */
body.woocommerce-order-pay #wc-square-digital-wallet,
body.woocommerce-order-pay #wc-square-google-pay {
  display: flex;
  justify-content: center;
  margin: 10px 0;
  width: 100%;
}

body.woocommerce-order-pay #apple-pay-button,
body.woocommerce-order-pay #gpay-button-online-api-id {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  overflow: hidden;
}

body.woocommerce-order-pay #wc-square-wallet-divider {
  text-align: center;
  margin: 6px 0 10px;
  width: 100%;
}

body.woocommerce-order-pay #wc-square-wallet-divider::before,
body.woocommerce-order-pay #wc-square-wallet-divider::after {
  content: "";
  display: inline-block;
  width: 80px;
  height: 1px;
  background: #e6e6e6;
  vertical-align: middle;
  margin: 0 10px;
}

body.woocommerce-order-pay #place_order {
  width: 100%;
  max-width: 420px;
  margin: 12px auto 0;
}
CSS;

    $js = <<<JS
document.addEventListener('DOMContentLoaded', function () {
  var wallet = document.querySelector('#wc-square-digital-wallet');
  var gpay = document.querySelector('#wc-square-google-pay');
  var divider = document.querySelector('#wc-square-wallet-divider');
  var payment = document.querySelector('#payment');

  if (wallet && payment) {
    payment.parentElement && payment.parentElement.insertBefore(wallet, payment);
    if (gpay) {
      wallet.insertAdjacentElement('afterend', gpay);
    }
    if (divider) {
      gpay ? gpay.insertAdjacentElement('afterend', divider) : wallet.insertAdjacentElement('afterend', divider);
    }
  }
});
JS;

    wp_register_style( 'rc-woo-checkout-skin', false );
    wp_enqueue_style( 'rc-woo-checkout-skin' );
    wp_add_inline_style( 'rc-woo-checkout-skin', $css );

    wp_register_script( 'rc-woo-checkout-skin', '', [], null, true );
    wp_enqueue_script( 'rc-woo-checkout-skin' );
    wp_add_inline_script( 'rc-woo-checkout-skin', $js );
  }
} );
