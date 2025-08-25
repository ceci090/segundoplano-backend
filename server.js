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

// Brújula
const brujulaSchema = new mongoose.Schema(
  {
    conductorId: { type: String, required: true, index: true },
    compass: { type: Number, required: true }, // Número en grados
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const Brujula = mongoose.model("Brujula", brujulaSchema);

// Ubicación
const ubicacionSchema = new mongoose.Schema(
  {
    conductorId: { type: String, required: true, index: true },
    latitud: { type: Number, required: true },
    longitud: { type: Number, required: true },
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const Ubicacion = mongoose.model("Ubicacion", ubicacionSchema);

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

// -------------------- Registro de lecturas --------------------

// Ritmo cardiaco
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

// Brújula
app.post("/brujula", async (req, res) => {
  try {
    const { conductorId, compass } = req.body;
    if (!conductorId || typeof compass !== "number")
      return res.status(400).json({ error: "conductorId y compass son requeridos" });

    const lectura = new Brujula({ conductorId, compass });
    await lectura.save();
    res.status(201).json({ message: "Brújula guardada", data: lectura });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ubicación
app.post("/ubicacion", async (req, res) => {
  try {
    const { conductorId, latitud, longitud } = req.body;
    if (!conductorId || latitud === undefined || longitud === undefined)
      return res.status(400).json({ error: "conductorId, latitud y longitud son requeridos" });

    const lectura = new Ubicacion({ conductorId, latitud, longitud });
    await lectura.save();
    res.status(201).json({ message: "Ubicación guardada", data: lectura });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- Consultas por conductor --------------------

// Última lectura de ritmo
app.get("/ritmo/:conductorId/latest", async (req, res) => {
  try {
    const doc = await Ritmo.findOne({ conductorId: req.params.conductorId }).sort({ createdAt: -1 });
    if (!doc) return res.status(404).json({ error: "Sin lecturas de ritmo" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Última lectura de brújula
app.get("/brujula/:conductorId/latest", async (req, res) => {
  try {
    const doc = await Brujula.findOne({ conductorId: req.params.conductorId }).sort({ createdAt: -1 });
    if (!doc) return res.status(404).json({ error: "Sin lecturas de brújula" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Última lectura de ubicación
app.get("/ubicacion/:conductorId/latest", async (req, res) => {
  try {
    const doc = await Ubicacion.findOne({ conductorId: req.params.conductorId }).sort({ createdAt: -1 });
    if (!doc) return res.status(404).json({ error: "Sin lecturas de ubicación" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- Última lectura combinada --------------------
app.get("/lectura/:conductorId/latest", async (req, res) => {
  try {
    const conductorId = req.params.conductorId;

    const [ritmo, brujula, ubicacion] = await Promise.all([
      Ritmo.findOne({ conductorId }).sort({ createdAt: -1 }),
      Brujula.findOne({ conductorId }).sort({ createdAt: -1 }),
      Ubicacion.findOne({ conductorId }).sort({ createdAt: -1 }),
    ]);

    if (!ritmo && !brujula && !ubicacion)
      return res.status(404).json({ error: "No hay lecturas para este conductor" });

    res.json({
      conductorId,
      ritmo: ritmo ? { bpm: ritmo.bpm, fecha: ritmo.fecha } : null,
      brujula: brujula ? { compass: brujula.compass, fecha: brujula.fecha } : null,
      ubicacion: ubicacion
        ? { latitud: ubicacion.latitud, longitud: ubicacion.longitud, fecha: ubicacion.fecha }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- Consultas generales --------------------

// Todos los conductores
app.get("/conductor/all", async (req, res) => {
  try {
    const conductores = await Conductor.find().sort({ createdAt: -1 });
    res.json({ total: conductores.length, data: conductores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Todas las lecturas de ritmo
app.get("/ritmo/all", async (req, res) => {
  try {
    const lecturas = await Ritmo.find().sort({ createdAt: -1 });
    res.json({ total: lecturas.length, data: lecturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Todas las lecturas de brújula
app.get("/brujula/all", async (req, res) => {
  try {
    const lecturas = await Brujula.find().sort({ createdAt: -1 });
    res.json({ total: lecturas.length, data: lecturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Todas las lecturas de ubicación
app.get("/ubicacion/all", async (req, res) => {
  try {
    const lecturas = await Ubicacion.find().sort({ createdAt: -1 });
    res.json({ total: lecturas.length, data: lecturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- BORRAR TODOS LOS CONDUCTORES Y LECTURAS (solo pruebas) --------------------
app.delete("/conductor/all", async (req, res) => {
  try {
    const borradoConductores = await Conductor.deleteMany({});
    const borradoRitmos = await Ritmo.deleteMany({});
    const borradoBrujula = await Brujula.deleteMany({});
    const borradoUbicacion = await Ubicacion.deleteMany({});
    res.json({
      message: "Todos los conductores y lecturas han sido borrados",
      conductoresBorrados: borradoConductores.deletedCount,
      ritmosBorrados: borradoRitmos.deletedCount,
      brujulaBorrados: borradoBrujula.deletedCount,
      ubicacionBorrados: borradoUbicacion.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- Arranque --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API corriendo en puerto ${PORT}`));
