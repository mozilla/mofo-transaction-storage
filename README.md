# mofo-transaction-storage

Pull down Coinbase & PayPal transactions into a database for various sundry porpoises

## Requirements

* node.js ^0.10.33
* postgres ^9.3.5
* PayPal Classic API credentials

## Setup

### Database

Run the following SQL to create the necessary table:

```sql
CREATE TABLE paypal (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE,
  type TEXT,
  email TEXT,
  name TEXT,
  status TEXT,
  amount MONEY,
  fee_amount MONEY,
  currency TEXT,
  country_code TEXT
);
```

### Environment

Create a file named `.env` to place configuration options in.

* PAYPAL_DB_CONNECTION_STRING
* PAYPAL_USERNAME
* PAYPAL_PASSWORD
* PAYPAL_SIGNATURE
* PAYPAL_START_DATE
* PAYPAL_STEP_MINUTES
* SERVER_HOST
* SERVER_PORT
* SERVER_DB_CONNECTION_STRING
* SERVER_START_DATE
* SERVER_END_DATE
