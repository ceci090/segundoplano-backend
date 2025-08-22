const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
require("dotenv").config();

const app = express();

// -------------------- Middlewares --------------------
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(morgan("dev"));

// -------------------- MongoDB --------------------
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ Error al conectar a MongoDB:", err.message);
    process.exit(1);
  });

// -------------------- Modelos --------------------

// Conductor
const conductorSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    edad: { type: Number, required: true, min: 0 },
    sexo: { type: String, enum: ["Masculino", "Femenino"], required: true },
    turno: { type: String, required: true },
    enfermedad: { type: String, required: true },
  },
  { timestamps: true }
);
const Conductor = mongoose.model("Conductor", conductorSchema);

// Ritmo cardiaco
const ritmoSchema = new mongoose.Schema(
  {
    conductorId: { type: String, required: true, index: true },
    bpm: { type: Number, required: true, min: 0 },
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const Ritmo = mongoose.model("Ritmo", ritmoSchema);

// -------------------- Rutas --------------------

// Salud del servidor
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    now: new Date().toISOString(),
  });
});

// Crear conductor
app.post("/conductor", async (req, res) => {
  try {
    const { nombre, edad, sexo, turno, enfermedad } = req.body;
    if (!nombre || !edad || !sexo || !turno || !enfermedad)
      return res.status(400).json({ error: "Todos los campos son requeridos" });

    const nuevo = new Conductor({ nombre, edad, sexo, turno, enfermedad });
    await nuevo.save();
    res.status(201).json({ message: "Conductor creado", data: nuevo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar ritmo cardiaco
app.post("/ritmo", async (req, res) => {
  try {
    const { conductorId, bpm } = req.body;
    if (!conductorId || typeof bpm !== "number")
      return res.status(400).json({ error: "conductorId y bpm son requeridos" });

    const lectura = new Ritmo({ conductorId, bpm });
    await lectura.save();
    res.status(201).json({ message: "Ritmo guardado", data: lectura });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener últimas lecturas por conductor
app.get("/ritmo/:conductorId/latest", async (req, res) => {
  try {
    const doc = await Ritmo.findOne({ conductorId: req.params.conductorId }).sort({ createdAt: -1 });
    if (!doc) return res.status(404).json({ error: "Sin lecturas" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- NUEVOS ENDPOINTS --------------------

// Obtener todos los conductores
app.get("/conductor/all", async (req, res) => {
  try {
    const conductores = await Conductor.find().sort({ createdAt: -1 });
    res.json({ total: conductores.length, data: conductores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener todos los ritmos cardiacos
app.get("/ritmo/all", async (req, res) => {
  try {
    const lecturas = await Ritmo.find().sort({ createdAt: -1 });
    res.json({ total: lecturas.length, data: lecturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- Arranque --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API corriendo en puerto ${PORT}`));
