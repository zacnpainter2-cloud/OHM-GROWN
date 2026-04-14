/**
 * AWS Lambda: IoT → Supabase Writer
 *
 * Triggered by the same IoT rule as the telemetry parser.
 * Receives the raw LoRaWAN event, parses the 10-byte payload,
 * and upserts the reading into Supabase.
 *
 * Environment variables (set in Lambda console):
 *   SUPABASE_URL  – e.g. https://vfqndcwsixvzstwmpbio.supabase.co
 *   SUPABASE_KEY  – your service_role key (NOT the anon key)
 *
 * Handler setting: index.handler
 */

"use strict";

var EXPECTED_LEN = 10;

function parsePayload(buf) {
  if (buf.length !== EXPECTED_LEN) {
    throw new Error("Bad payload length: " + buf.length + " (expected " + EXPECTED_LEN + ")");
  }

  var ec = buf.readUInt16BE(0);
  var ph = buf[2];
  var temp = buf.readInt16BE(3);
  var o2 = buf.readUInt16BE(5);
  var waterLevel = buf[7];
  var transpiration = buf[8];
  var flags = buf[9];

  return {
    ec: ec,
    ph: ph / 10,
    temperature: temp / 10,
    o2: o2 / 10,
    waterLevel: waterLevel / 10,
    transpiration: transpiration,
    ecDosing: (flags & 0x80) !== 0,
    phDosing: (flags & 0x40) !== 0,
    waterFlowOk: (flags & 0x20) !== 0,
  };
}

function getPayloadBytes(event) {
  var b64 = event.PayloadData;
  if (b64) return Buffer.from(b64, "base64");

  var hex = event.payloadHex;
  if (hex) return Buffer.from(hex, "hex");

  return null;
}

async function upsertToSupabase(row) {
  var url = process.env.SUPABASE_URL + "/rest/v1/measurements";

  var res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_KEY,
      "Authorization": "Bearer " + process.env.SUPABASE_KEY,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    var body = await res.text();
    if (res.status === 409) {
      console.log("Duplicate timestamp, skipped.");
      return;
    }
    throw new Error("Supabase " + res.status + ": " + body);
  }
}

exports.handler = async function(event) {
  console.log("Event:", JSON.stringify(event).slice(0, 500));

  var payload = getPayloadBytes(event);
  if (!payload) {
    console.warn("No payload in event, skipping.");
    return { statusCode: 400, body: "No payload" };
  }

  var parsed;
  try {
    parsed = parsePayload(payload);
  } catch (err) {
    console.error("Parse error:", err.message);
    return { statusCode: 400, body: err.message };
  }

  if (parsed.temperature === 0 && parsed.ph === 0 && parsed.ec === 0) {
    console.warn("All-zero reading, skipping.");
    return { statusCode: 200, body: "Skipped zero reading" };
  }

  var now = new Date().toISOString();

  var row = {
    recorded_at: now,
    ec: parsed.ec,
    ph: parsed.ph,
    temperature: parsed.temperature,
    dissolved_oxygen: parsed.o2,
    water_level: parsed.waterLevel,
    transpiration_rate: parsed.transpiration,
    ec_dosing_flag: parsed.ecDosing ? 1 : 0,
    ph_dosing_flag: parsed.phDosing ? 1 : 0,
    water_flow_ok: parsed.waterFlowOk ? 1 : 0,
    network_status: "online",
  };

  try {
    await upsertToSupabase(row);
    console.log("Saved to Supabase:", now);
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Supabase write failed:", err.message);
    return { statusCode: 500, body: err.message };
  }
};
