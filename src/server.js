require('dotenv').config();
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");




const authRoutes = require("./routes/authRoutes");


const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());


app.get('/test', (req, res) => {
    res.status(200).send('Server is working!');
});

// Routes
app.use("/", authRoutes);
app.use((req, res) => {
    console.log(`Route not found: ${req.method} ${req.url}`);
    res.status(404).send('Route not found');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
