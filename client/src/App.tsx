import React, { useEffect } from 'react'
import { BrowserRouter, Route, Switch } from "react-router-dom"
import './App.css'
// import components
import Home from './components/Home/Home'
import Login from './components/Login/Login'

function App() {

  // Test connection to server on app load
  useEffect(() => {
    fetch('/api')
    .then((res) => res.json())
    .then((data) => console.log(data))
  }, []);

  return (
    <div className="app">
      {/* App routing */}
      <BrowserRouter>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/login" component={Login} />
        </Switch>
      </BrowserRouter>
    </div>
  );
}

export default App;
