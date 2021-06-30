"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const PORT = process.env.PORT || 3001;
const app = express_1.default();
// Have Node serve the files for our built React app
app.use(express_1.default.static(path_1.default.resolve(__dirname, '../client/build')));
// api request endpoint
app.get("/api", (req, res) => {
    res.json({ message: "Hello from server!" });
});
// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
    res.sendFile(path_1.default.resolve(__dirname, '../client/build', 'index.html'));
});
// app.listen must be at bottom
app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});
