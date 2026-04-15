/**
 * AWS Lambda: IoT → Supabase Writer + Alert & Dosing Monitor
 *
 * Triggered by the IoT rule on every sensor reading.
 * 1. Parses the 10-byte LoRaWAN payload
 * 2. Saves the measurement to Supabase
 * 3. Checks thresholds and manages alert_history
 * 4. Detects dosing flag transitions and logs to dosing_history
 *
 * Environment variables (set in Lambda console):
 *   SUPABASE_URL  – e.g. https://vfqndcwsixvzstwmpbio.supabase.co
 *   SUPABASE_KEY  – your service_role key (NOT the anon key)
 *
 * Handler setting: index.handler
 * Timeout: 10 seconds (needs multiple Supabase calls)
 */

"use strict";

var EXPECTED_LEN = 10;
var BASE_URL = "";
var HEADERS = {};

function initSupabase() {
  BASE_URL = process.env.SUPABASE_URL + "/rest/v1";
  HEADERS = {
    "Content-Type": "application/json",
    "apikey": process.env.SUPABASE_KEY,
    "Authorization": "Bearer " + process.env.SUPABASE_KEY,
  };
}

// ── Payload parsing ──────────────────────────────────────────────
//
// Uses Node.js Buffer API to decode the 10-byte LoRaWAN binary payload.
// Methods used: Buffer.from() (base64/hex decode), readUInt16BE(),
// readInt16BE(), and bitwise AND for flag extraction.
//
// Reference: Node.js Docs — Buffer
// https://nodejs.org/api/buffer.html
// Specifically:
//   buf.readUInt16BE(offset) — https://nodejs.org/api/buffer.html#bufreaduint16beoffset
//   buf.readInt16BE(offset)  — https://nodejs.org/api/buffer.html#bufreadint16beoffset
//   Buffer.from(string, encoding) — https://nodejs.org/api/buffer.html#static-method-bufferfromstring-encoding

function parsePayload(buf) {
  if (buf.length !== EXPECTED_LEN) {
    throw new Error("Bad payload length: " + buf.length + " (expected " + EXPECTED_LEN + ")");
  }
  return {
    ec: buf.readUInt16BE(0),
    ph: buf[2] / 10,
    temperature: buf.readInt16BE(3) / 10,
    o2: buf.readUInt16BE(5) / 10,
    waterLevel: buf[7] / 10,
    transpiration: buf[8],
    ecDosing: (buf[9] & 0x80) !== 0,
    phDosing: (buf[9] & 0x40) !== 0,
    waterFlowOk: (buf[9] & 0x20) !== 0,
  };
}

function getPayloadBytes(event) {
  if (event.PayloadData) return Buffer.from(event.PayloadData, "base64");
  if (event.payloadHex) return Buffer.from(event.payloadHex, "hex");
  return null;
}

// ── Supabase REST helpers ────────────────────────────────────────

async function sbPost(table, body, prefer) {
  var res = await fetch(BASE_URL + "/" + table, {
    method: "POST",
    headers: Object.assign({}, HEADERS, { "Prefer": prefer || "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 409) {
    var text = await res.text();
    console.warn("POST " + table + " " + res.status + ": " + text);
  }
  return res;
}

async function sbPatch(table, query, body) {
  var res = await fetch(BASE_URL + "/" + table + "?" + query, {
    method: "PATCH",
    headers: Object.assign({}, HEADERS, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    var text = await res.text();
    console.warn("PATCH " + table + " " + res.status + ": " + text);
  }
  return res;
}

async function sbGet(table, query) {
  var res = await fetch(BASE_URL + "/" + table + "?" + query, {
    method: "GET",
    headers: Object.assign({}, HEADERS, { "Accept": "application/json" }),
  });
  if (!res.ok) {
    var text = await res.text();
    console.warn("GET " + table + " " + res.status + ": " + text);
    return [];
  }
  return res.json();
}

// ── Save measurement ─────────────────────────────────────────────

async function saveMeasurement(parsed, now) {
  var res = await sbPost("measurements", {
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
  }, "resolution=merge-duplicates");

  if (res.ok || res.status === 409) {
    console.log("Saved to Supabase:", now);
  }
}

// ── Alert checking ───────────────────────────────────────────────

async function checkAlerts(parsed, now) {
  // Fetch thresholds and active alerts in parallel
  var results = await Promise.all([
    sbGet("control_settings", "order=updated_at.desc&limit=1"),
    sbGet("alert_history", "end_time=is.null&select=id,alert_type,start_time"),
  ]);

  var settings = results[0];
  var activeAlerts = results[1];

  if (!settings || settings.length === 0) {
    console.warn("No control_settings found, skipping alert check.");
    return;
  }

  var s = settings[0];
  var thresholds = {
    ec:          { lower: Number(s.ec_lower_threshold ?? 1000),  upper: Number(s.ec_upper_threshold ?? 1800) },
    ph:          { lower: Number(s.ph_lower_threshold ?? 6.5),   upper: Number(s.ph_upper_threshold ?? 8.5) },
    temperature: { lower: Number(s.temperature_lower_threshold ?? 18.3), upper: Number(s.temperature_upper_threshold ?? 26.7) },
    o2:          { lower: Number(s.o2_lower_threshold ?? 6),     upper: Number(s.o2_upper_threshold ?? 12) },
    waterLevel:  { lower: Number(s.water_level_lower_threshold ?? 70),   upper: Number(s.water_level_upper_threshold ?? 95) },
  };

  // Build a map of currently active alerts by type (array to handle duplicates)
  var activeMap = {};
  (activeAlerts || []).forEach(function(a) {
    if (!activeMap[a.alert_type]) activeMap[a.alert_type] = [];
    activeMap[a.alert_type].push(a);
  });

  var checks = [
    { type: "temperature", value: parsed.temperature, t: thresholds.temperature, label: "Temperature" },
    { type: "ec",          value: parsed.ec,          t: thresholds.ec,          label: "EC" },
    { type: "ph",          value: parsed.ph,          t: thresholds.ph,          label: "pH" },
    { type: "waterLevel",  value: parsed.waterLevel,  t: thresholds.waterLevel,  label: "Water Level" },
  ];

  var currentAlertTypes = {};

  // Check each parameter
  for (var i = 0; i < checks.length; i++) {
    var c = checks[i];
    var outOfBounds = c.value < c.t.lower || c.value > c.t.upper;

    if (outOfBounds) {
      currentAlertTypes[c.type] = true;
      var direction = c.value < c.t.lower ? "Too Low" : "Too High";

      if (!activeMap[c.type] || activeMap[c.type].length === 0) {
        await sbPost("alert_history", {
          alert_type: c.type,
          severity: "critical",
          message: c.label + " " + direction,
          start_time: now,
          end_time: null,
          duration_ms: null,
        });
        console.log("Alert STARTED: " + c.type + " " + direction);
      }
    }
  }

  // Check water flow
  if (!parsed.waterFlowOk) {
    currentAlertTypes["waterFlow"] = true;
    if (!activeMap["waterFlow"] || activeMap["waterFlow"].length === 0) {
      await sbPost("alert_history", {
        alert_type: "waterFlow",
        severity: "critical",
        message: "Water Flow Issue Detected (No Flow)",
        start_time: now,
        end_time: null,
        duration_ms: null,
      });
      console.log("Alert STARTED: waterFlow");
    }
  }

  // End alerts that are no longer active (close ALL duplicates for each type)
  var keys = Object.keys(activeMap);
  for (var j = 0; j < keys.length; j++) {
    var type = keys[j];
    if (!currentAlertTypes[type]) {
      // Use the earliest start_time for duration calculation
      var earliest = activeMap[type].reduce(function(min, a) {
        return new Date(a.start_time) < new Date(min.start_time) ? a : min;
      });
      var startMs = new Date(earliest.start_time).getTime();
      var endMs = new Date(now).getTime();
      var duration = endMs - startMs;

      // Patch by type + open status to close ALL duplicates at once
      await sbPatch("alert_history", "alert_type=eq." + type + "&end_time=is.null", {
        end_time: now,
        duration_ms: duration,
      });
      console.log("Alert ENDED: " + type + " (closed " + activeMap[type].length + ", duration " + Math.round(duration / 1000) + "s)");
    }
  }

  return thresholds;
}

// ── Dosing detection ─────────────────────────────────────────────

async function checkDosing(parsed, now, thresholds) {
  // Get the previous measurement to compare dosing flags
  var prev = await sbGet("measurements", "order=recorded_at.desc&limit=1&offset=1&select=ec_dosing_flag,ph_dosing_flag");

  if (!prev || prev.length === 0) return;

  var prevEC = Number(prev[0].ec_dosing_flag || 0);
  var prevPH = Number(prev[0].ph_dosing_flag || 0);
  var currEC = parsed.ecDosing ? 1 : 0;
  var currPH = parsed.phDosing ? 1 : 0;

  // EC dosing transitions
  if (currEC === 1 && prevEC === 0) {
    await sbPost("dosing_history", {
      event_type: "EC", action: "started",
      sensor_value: parsed.ec, occurred_at: now,
    });
    console.log("Dosing STARTED: EC at " + parsed.ec);
  }
  if (currEC === 0 && prevEC === 1) {
    await sbPost("dosing_history", {
      event_type: "EC", action: "stopped",
      sensor_value: parsed.ec, occurred_at: now,
    });
    console.log("Dosing STOPPED: EC at " + parsed.ec);
  }

  // pH dosing transitions (only log "started" when pH is below lower threshold)
  if (currPH === 1 && prevPH === 0 && thresholds && parsed.ph < thresholds.ph.lower) {
    await sbPost("dosing_history", {
      event_type: "pH", action: "started",
      sensor_value: parsed.ph, occurred_at: now,
    });
    console.log("Dosing STARTED: pH at " + parsed.ph);
  }
  if (currPH === 0 && prevPH === 1) {
    await sbPost("dosing_history", {
      event_type: "pH", action: "stopped",
      sensor_value: parsed.ph, occurred_at: now,
    });
    console.log("Dosing STOPPED: pH at " + parsed.ph);
  }
}

// ── Main handler ─────────────────────────────────────────────────

exports.handler = async function(event) {
  console.log("Event:", JSON.stringify(event).slice(0, 500));
  initSupabase();

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

  // 1. Save measurement first
  try {
    await saveMeasurement(parsed, now);
  } catch (err) {
    console.error("Measurement save failed:", err.message);
    return { statusCode: 500, body: err.message };
  }

  // 2. Check alerts and dosing (don't let failures block the response)
  var thresholds = null;
  try {
    thresholds = await checkAlerts(parsed, now);
  } catch (err) {
    console.error("Alert check failed:", err.message);
  }

  try {
    await checkDosing(parsed, now, thresholds);
  } catch (err) {
    console.error("Dosing check failed:", err.message);
  }

  return { statusCode: 200, body: "OK" };
};
