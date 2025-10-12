// server.mjs
import express from "express";
import cors from "cors";
import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = "your_jwt_secret_key";
const PORT = process.env.PORT || 4000;

const users = [{ username: "admin", password: bcrypt.hashSync("123", 8) }];

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ message: "User not found" });

  const passwordIsValid = bcrypt.compareSync(password, user.password);
  if (!passwordIsValid)
    return res.status(401).json({ message: "Invalid password" });

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ token });
});

// Mock data OHLCV
function generateMockOHLCV(limit = 200) {
  return Array.from({ length: limit }).map((_, i) => ({
    time: Math.floor(Date.now() / 1000) - (limit - i) * 3600,
    open: Math.random() * 1000 + 100,
    high: Math.random() * 1000 + 110,
    low: Math.random() * 1000 + 90,
    close: Math.random() * 1000 + 100,
    volume: Math.random() * 50,
  }));
}

// Lấy OHLCV từ Binance mainnet, fallback mock khi lỗi
async function fetchOHLCV(symbol = "ETHUSDT", interval = "1h", limit = 200) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  try {
    const res = await axios.get(url, { timeout: 5000 });
    return res.data.map((c) => ({
      time: Math.floor(c[0] / 1000),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    }));
  } catch (err) {
    console.error("Binance API error, returning mock data:", err.message);
    return generateMockOHLCV(limit);
  }
}

// Route /risk/:symbol
app.get("/risk/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const interval = req.query.interval || "1h";
    const limit = parseInt(req.query.limit) || 200;

    console.log(`Fetching ${symbol} with interval ${interval}, limit ${limit}`);

    const candles = await fetchOHLCV(symbol, interval, limit);

    if (!candles.length) return res.status(404).json({ error: "No candles" });

    // Flags logic
    const flagsMap = {};
    candles.forEach((c, idx) => {
      flagsMap[c.time] = [];

      let frequency = 10;
      if (interval.includes("m")) frequency = 5;
      if (interval.includes("d")) frequency = 20;

      if (idx % frequency === 0) flagsMap[c.time].push("SMC");
      if (idx % (frequency + 5) === 0) flagsMap[c.time].push("SHOCK");
      if (idx % (frequency - 3) === 0) flagsMap[c.time].push("LIQ");
      if (idx % (frequency + 10) === 0) flagsMap[c.time].push("WYCK");
    });

    const latest = candles[candles.length - 1];
    const score = Math.floor(Math.random() * 100);

    res.json({
      symbol,
      score,
      flagsMap,
      latest,
      candles,
      interval,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
