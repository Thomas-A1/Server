const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const passport = require("passport");
const session = require("express-session");

require("./config/passport");

const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
    origin: ['https://uni-ghana.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// ✅ Session middleware must go before passport.session
app.use(session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 1000 * 60 * 60
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use("/", authRoutes);

app.use((req, res) => {
    console.log(`Route not found: ${req.method} ${req.url}`);
    res.status(404).send('Route not found');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
