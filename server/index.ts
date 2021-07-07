import express, { Request, Response } from 'express'
import path from 'path'
import cors from 'cors'
import dotenv from 'dotenv';
import bodyParser from 'body-parser'
// import routes
import login from './routes/loginRoutes'

// Allow use of environmental variables
dotenv.config();

const PORT = process.env.PORT || 3001;

const app = express();

// Allows requests from specified orgins only
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002']
}));

// Get the body data as json from requests 
app.use(bodyParser.json());

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, '../client/build')));

// api request endpoints ---

// Test connection to server
app.get("/api", (req: Request, res: Response) => {
  res.json({ message: "Hello from server!" });
});

// Routes for user login attempts
app.use("/api/login", login);

// All other GET requests not handled before will return React app
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
});

// app.listen must be at bottom
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});