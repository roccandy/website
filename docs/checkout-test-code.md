# Checkout test code

The customer checkout's **Code** field accepts the private testing code. Select
**Apply code** before paying. A valid code sets the entire checkout total to
A$0.01 (not A$0.01 per item).

- The server validates the code both when applying it and when preparing payment.
  The code itself is not included in customer JavaScript.
- Invalid or disabled codes block payment until removed or reapplied; they do
  not silently fall back to charging the full price.
- Orders created with the code retain `test` status after payment, keeping them
  out of the normal production schedule. Customer confirmation emails still send.
- Anyone who knows the code can use the test price. Keep it private and use your
  own customer/email details for testing.
- Set the server environment variable `CHECKOUT_TEST_CODE_ENABLED=false` and
  redeploy to disable the override. Code verification is rate-limited, but this
  is not a substitute for keeping the code private.

Automated coverage checks validation, pricing across multiple items, preservation
of test status, payment fingerprints, and the code-verification endpoint. These
tests mock payment and order persistence; they do not submit real payments.
