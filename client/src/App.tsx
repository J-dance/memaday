import React, { useState } from 'react'
import './App.css'

function App() {

  React.useEffect(() => {
    fetch("/api")
      .then((res) => res.json())
      .then((data) => console.log(data.message));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Hi</h1>
      </header>
    </div>
  );
}

export default App;
