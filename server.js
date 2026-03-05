const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db.js");

const app = express();
app.set("trust proxy", 1);
connectDB();

const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",

  "https://kcespotlight2.vercel.app",
  "https://kcespotlight2-git-main-poovarasans-projects-e0246408.vercel.app",
  "https://kcespotlight2-c5g5htfg2-poovarasans-projects-e0246408.vercel.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked by CORS:", origin);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], 
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-app-client",
    "ngrok-skip-browser-warning",
    "Accept",
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("(.*)", cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Make uploads folder static
app.use("/uploads", express.static("uploads"));

// ✅ ROUTES (paths must be EXACT)
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/achievers", require("./routes/achieverRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/unstop", require("./routes/proxyRoutes"));
app.use("/api/rewards", require("./routes/rewardRoutes"));
app.use("/api/semester", require("./routes/semesterRoutes"));
app.use("/api/staff", require("./routes/staffRoutes"));
app.use("/api/career",require("./routes/careerRoutes.js"));
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  console.log("Allowed Origins:", allowedOrigins);
});

app.use("/api/check-aws", (req, res) => {
  return res.json({ message: "hello hero" });
});

app.use("/api/host-contribute", (req, res) => {
  return res.json({ message: "hello ace im spotlight" });
});

// Deep Link Redirection Route
app.get("/event/:id", (req, res) => {
  const eventId = req.params.id;
  const appScheme = `karpagam-spotlight://event/${eventId}`;
  // Fallback URL (APK Download Link, Expo Project Page, or Play Store)
  const fallbackUrl = process.env.FALLBACK_URL || "https://expo.dev/@poovarasa13/my-app"; 

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>View Event</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 40px 20px; background-color: #f9fafb; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #111827; font-size: 24px; margin-bottom: 10px; }
          p { color: #6b7280; font-size: 16px; margin-bottom: 25px; line-height: 1.5; }
          .btn { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 5px; transition: opacity 0.2s; }
          .btn:hover { opacity: 0.9; }
          .btn-secondary { background-color: #f3f4f6; color: #374151; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Open in Spotlight</h1>
          <p>You can view this event in the Karpagam Spotlight app.</p>
          
          <a href="${appScheme}" class="btn">Open App</a>
          
          <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <p style="font-size: 14px;">Don't have the app?</p>
            <a href="${fallbackUrl}" class="btn btn-secondary">Download / Install</a>
          </div>
        </div>
        
        <script>
          // Automatic redirect to app scheme
          setTimeout(function() {
            window.location.href = "${appScheme}";
          }, 100);
        </script>
      </body>
    </html>
  `;
  res.send(html);
});
