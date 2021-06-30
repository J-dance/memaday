# memaday app

## About

## Deployment Notes

1.  You *must build* client react-app **before** deployment. Run: 
    $ npm run build-client
    in the root directory or in client directory run:
    $ npm run build
    React handles the build and outputs to public/build folder.
2.  You *must then* build the node-Express API. Run: 
    $ npm run build-server
    - This will output .js files in root/dist folder.
3.  Deployment to Heroku: Run the following in CLi in the root directory:
    - $ git add .
    - $ git commit -m "message"
    - $ git push heroku master
Changes should now be observed upon successful build and deployment at:
    - https://memaday.herokuapp.com/
