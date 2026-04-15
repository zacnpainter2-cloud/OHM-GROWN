# Supabase Writer Lambda — Setup Guide

This Lambda writes every IoT sensor reading directly to Supabase,
so data is saved even when nobody has the website open.

## Prerequisites
- AWS Console access
- Your Supabase **service_role** key (Dashboard → Settings → API → service_role secret)

---

## Step 1: Create the Lambda Function

1. Go to **AWS Lambda** → **Create function**
2. Settings:
   - **Name**: `supabase-writer`
   - **Runtime**: Node.js 20.x
   - **Architecture**: arm64 (cheaper) or x86_64
3. Click **Create function**

## Step 2: Upload the Code

1. Open the `lambda/supabase-writer/index.mjs` file from this repo
2. In the Lambda console, paste the contents into the code editor
3. Click **Deploy**

*(No dependencies needed — uses built-in `fetch` available in Node 20+)*

## Step 3: Set Environment Variables

In the Lambda → **Configuration** → **Environment variables**, add:

| Key             | Value                                              |
|-----------------|----------------------------------------------------|
| `SUPABASE_URL`  | `https://vfqndcwsixvzstwmpbio.supabase.co`        |
| `SUPABASE_KEY`  | Your **service_role** key (from Supabase dashboard) |

> **Important**: Use the `service_role` key, NOT the anon/public key.
> The anon key may be blocked by Row Level Security policies.

## Step 4: Add the IoT Rule Trigger

You already have an IoT Rule that triggers the telemetry-parser Lambda.
Add a **second action** to the same rule:

1. Go to **AWS IoT Core** → **Message routing** → **Rules**
2. Find the rule that triggers your telemetry parser
3. Click **Edit**
4. Under **Rule actions**, click **Add action**
5. Choose **Lambda** → select `supabase-writer`
6. Click **Update rule**

This makes both Lambdas fire on every sensor reading — DynamoDB and Supabase
get written to simultaneously.

## Step 5: Set Timeout

1. Lambda → **Configuration** → **General configuration** → **Edit**
2. Set **Timeout** to **10 seconds** (default 3s may be tight for Supabase writes)

## Step 6: Test

1. Wait for your next sensor reading (~1 minute)
2. Check Supabase Table Editor — a new row should appear
3. Check Lambda **Monitor** → **CloudWatch Logs** if something goes wrong

---

## How It Works

```
Sensor → LoRaWAN → AWS IoT Core
                        │
                        ├─→ telemetry-parser (existing) → DynamoDB
                        │
                        └─→ supabase-writer (new) → Supabase
```

Both paths run in parallel. If one fails, the other still works.
The `recorded_at` unique constraint in Supabase prevents duplicates
if the website also happens to save the same reading.
