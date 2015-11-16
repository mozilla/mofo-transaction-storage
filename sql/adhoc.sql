# A file to keep a record of some useful ad-hoc queries


-- Grouping by donor, looking at biggest cumulative gifts
SELECT * FROM (
  SELECT email, MIN(timestamp) as first_donation,
    MAX(timestamp) as most_recent_donation,
    SUM(CASE WHEN status='Completed' THEN amount ELSE '0'::money END) as amt_completed,
    SUM(CASE WHEN status='Returned' THEN amount ELSE '0'::money END) as amt_refunded,
    SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as num_completed,
    SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as num_cancelled,
    SUM(CASE WHEN status='Refunded' THEN 1 ELSE 0 END) as num_refunded,
    SUM(CASE WHEN status='Reversed' THEN 1 ELSE 0 END) as num_reversed,
    SUM(CASE WHEN status='Returned' THEN 1 ELSE 0 END) as num_returned,
    COUNT(1) as number_of_transactions,
    MAX(CASE WHEN status='Completed' THEN amount ELSE '0'::money END) as max_donation_to_date,
    currency, country_code
  FROM paypal
  --WHERE country_code = 'CA'
  GROUP BY email, currency, country_code
  ORDER BY amt_completed DESC
) AS aggregates
  WHERE num_reversed <= 1;


-- Donor history for EOY email selections
SELECT email,
  highest_previous_gift::numeric,
  most_recent_donation_date,
  number_of_donations,
  CASE WHEN num_completed_in_prior_months >= 3 THEN TRUE ELSE FALSE END as is_regular_donor
 FROM (
  SELECT email,
    MAX(timestamp) as most_recent_donation_date,
    SUM(CASE WHEN status='Completed' AND timestamp > NOW() - INTERVAL '120 days' THEN 1 ELSE 0 END) as num_completed_in_prior_months,
    SUM(CASE WHEN status='Reversed' THEN 1 ELSE 0 END) as num_reversed,
    COUNT(1) as number_of_donations,
    MAX(CASE WHEN status='Completed' THEN amount ELSE '0'::money END) as highest_previous_gift
  FROM paypal
  --WHERE country_code = 'CA'
  GROUP BY email
  ORDER BY highest_previous_gift DESC
) AS aggregates
  WHERE num_reversed <= 1
  AND highest_previous_gift > '0.5'::money
  ORDER BY is_regular_donor DESC, num_completed_in_prior_months DESC, number_of_donations;




-- Transaction Types
SELECT DISTINCT type, status FROM paypal ORDER BY type, status;

-- "Authorization";"Expired"
-- "Authorization";"Pending"
-- "Bill";"Pending"
-- "Canceled Payment";"Completed"
-- "Currency Conversion (credit)";"Completed"
-- "Currency Conversion (credit)";"Pending"
-- "Currency Conversion (debit)";"Completed"
-- "Currency Conversion (debit)";"Pending"
-- "Donation";"Canceled"
-- "Donation";"Cleared"
-- "Donation";"Completed"
-- "Donation";"Held"
-- "Donation";"Pending"
-- "Donation";"Refunded"
-- "Donation";"Reversed"
-- "Donation";"Uncleared"
-- "Fee Reversal";"Completed"
-- "Fee Reversal";"Pending"
-- "Payment";"Canceled"
-- "Payment";"Cleared"
-- "Payment";"Completed"
-- "Payment";"Held"
-- "Payment";"Partially Refunded"
-- "Payment";"Pending"
-- "Payment";"Refunded"
-- "Payment";"Returned"
-- "Payment";"Reversed"
-- "Payment";"Uncleared"
-- "Payment";"Under Review"
-- "Received Settlement Withdrawal";"Completed"
-- "Recover";"Completed"
-- "Recurring Payment";"Completed"
-- "Recurring Payment";"Created"
-- "Refund";"Completed"
-- "Refund";"Pending"
-- "Reversal";"Completed"
-- "Subscription Cancellation";"Canceled"
-- "Subscription Creation";"Active"
-- "Subscription Creation";"Canceled"
-- "Temporary Hold";"Placed"
-- "Temporary Hold";"Removed"
-- "Transfer";"Completed"
-- "Transfer";"Denied"
-- "Transfer";"Uncleared"


-- Looking at spam
SELECT type, status, SUM(amount) FROM paypal
  WHERE email='x'
  GROUP BY type, status;
