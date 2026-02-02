<?php
/**
 * Plugin Name: Roc Candy Woo Return URL
 * Description: Overrides the WooCommerce order received URL to the Next.js success page.
 * Version: 0.1.0
 * Author: Roc Candy
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

add_filter('woocommerce_get_checkout_order_received_url', function ($url, $order) {
  // TODO: update to your live domain when switching.
  $return_url = 'https://roccandy.vercel.app/checkout/success';
  return $return_url;
}, 10, 2);
