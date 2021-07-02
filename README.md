# memaday app

## About

memAday stands for 'memory a day' where a user can create an account, then create a group. the group has customizable features such as group name, photo, members and themes. The group creater has admin privileges, enabling other users to join who can then gain admin privileges as well. These include:
*   Ability to add/remove users
*   Ability to Edit group features
*   Ability to Upload content

Group members can view the content or 'memory' of that day which is displayed and enables group members to comments. The memory changes each day and is randomly selected from the database of uploads. Users can view the previous day as well however once this expires the upload will not be selected until reset. The comments are deleted after expiry.

Project built with a React-TypeScript front end and a Node-TypeScript Express server/api with PostgreSQL datbase.

## Deployment Notes

Note: if you have made changes:

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
