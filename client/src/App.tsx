import React, { useState } from 'react'
import { BrowserRouter, Route, Switch } from "react-router-dom"
import './App.css'
// import components
import Home from './components/Home/Home'
import Login from './components/Login/Login'

function App() {

  // React.useEffect(() => {
  //   fetch("/api")
  //     .then((res) => res.json())
  //     .then((data) => console.log(data.message));
  // }, []);

  return (
    <div className="app">
      <BrowserRouter>
        <Switch>
          <Route exact path="/" component={Login} />
          <Route path="/user" component={Home} />
        </Switch>
      </BrowserRouter>
    </div>
  );
}

export default App;
