import express, { Request, Response } from 'express'
import path from 'path'

const PORT = process.env.PORT || 3001;

const app = express();

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, '../client/build')));

// api request endpoint
app.get("/api", (req: Request, res: Response) => {
  res.json({ message: "Hello from server!" });
});

// All other GET requests not handled before will return our React app
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
});

// app.listen must be at bottom
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});