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

// Lấy OHLCV từ Binance với interval linh hoạt
async function fetchOHLCV(symbol = "ETHUSDT", interval = "1h", limit = 200) {
  const url = `https://testnet.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await axios.get(url);
  return res.data.map((c) => ({
    time: Math.floor(c[0] / 1000), // timestamp ms
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

// Route /risk/:symbol với query parameter interval
app.get("/risk/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const interval = req.query.interval || "1h"; // Nhận interval từ query parameter
    const limit = req.query.limit || 200;

    console.log(`Fetching ${symbol} with interval ${interval}, limit ${limit}`);

    const candles = await fetchOHLCV(symbol, interval, limit);

    if (!candles.length) return res.status(404).json({ error: "No candles" });

    // Flags demo - điều chỉnh dựa trên interval
    const flagsMap = {};
    candles.forEach((c, idx) => {
      flagsMap[c.time] = [];

      // Điều chỉnh tần suất flags dựa trên interval
      let frequency = 10;
      if (interval.includes("m")) frequency = 5; // Với interval phút, hiển thị nhiều flags hơn
      if (interval.includes("d")) frequency = 20; // Với interval ngày, ít flags hơn

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
      interval, // Trả về interval đã dùng cho frontend
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Binance API error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ BE running at http://localhost:${PORT}`);
});
