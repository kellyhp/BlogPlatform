const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const { createCanvas, loadImage } = require('canvas');
let crypto = require('crypto');
const passport = require('passport');
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs');
const { initializeDB } = require('./populatedb');
const { showDatabaseContents } = require('./showdb');
const { passportSetup } = require('./passport.js');
let db;


require('dotenv').config();
const accessToken = process.env.EMOJI_API_KEY;
const clientKey = process.env.CLIENT_ID;
const clientKey_secret = process.env.CLIENT_SECRET;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/


// function: setting up the database
async function getDBConnection () {
    console.log("Does file exist?", fs.existsSync('your_database_file.db'));
    if (!fs.existsSync('your_database_file.db')) {
        await initializeDB();
        console.log("doing initializeDB")
    } else {
        console.log("skipping initializeDB")
    }
    await showDatabaseContents();
    db = await sqlite.open({
        filename: 'your_database_file.db',
        driver: sqlite3.Database
    });
    app.locals.db = db; 
    console.log('Database connection established.');
}

// function: pulling up the databse


// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
            isLoggedInAndOwner: function (postUser, options) {
                let currUser = this.user.username;
                if (postUser === currUser) {
                    return options.fn(this);
                }
                return options.inverse(this);
            }
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'MicroBlog';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
async function activateServer () {
    try {
        await getDBConnection();
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.log('could not establish a connection to the database');
        console.log(error)
    }
}

activateServer();

// Example data for posts and users

/*let posts = [
    { id: 1, title: 'Sample Post', content: 'This is a sample post.', username: 'Jordan', timestamp: '2024-01-01 10:00', likes: 0 },
    { id: 2, title: 'Another Post', content: 'This is another sample post.', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0 },
]; */

/* let users = [
    { id: 1, username: 'SampleUser', avatar_url: undefined, memberSince: '2024-01-01 08:00', likedPosts: [] },
    { id: 2, username: 'AnotherUser', avatar_url: undefined, memberSince: '2024-01-02 09:00', likedPosts: [] },
    { id: 3, username: 'Kelly', avatar_url: undefined, memberSince: '2024-01-02 09:00', likedPosts: [] },
];
*/

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', async (req, res) => {
    const posts = await getPosts();
    const user = await getCurrentUser(req) || {};
    res.render('home', { posts, user, accessToken });
});

// Additional routes that you must implement

app.get('/post/:id', (req, res) => {
    // TODO: Render post detail page
    const postId = parseInt(req.params.id, 10);
    const post = posts.find(post => post.id === postId);
    if (post) {
        res.render('postDetail', { post });
    } else {
        res.status(404).send('Post not found');
    }
});


app.post('/posts', async (req, res) => {
    // TODO: Add a new post and redirect to home
    let newContent = req.body.content;
    let newTitle = req.body.title;
    let postUser = await getCurrentUser(req)
    postUser = postUser.username; // needed to wait for getCurrentUser to finish before accessing username
    await addPost(newTitle, newContent, postUser);
    res.redirect('/');
});

app.post('/like/:id', isAuthenticated, (req, res) => {
    // TODO: Update post likes
    const postID = parseInt(req.params.id);
    const currentUser = getCurrentUser(req);

    const result = updatePostLikes(postID, currentUser.username);
    if (result.likes !== undefined) {
        res.json({
            status: 'success',
            likeCounter: result.likes
        });
    } else {
        res.json({
            status: 'error',
            message: result.error
        });
    }
});


app.post('/delete/:id', isAuthenticated, async (req, res) => {
    // Delete a post if the current user is the owner
    const deleteID = parseInt(req.params.id);
    // console.log('Post ID needs to be deleted:', deleteID);

    // Find the post to delete
    // const postIndex = posts.findIndex(post => post.id === deleteID);
     post = await db.get('SELECT * FROM posts WHERE id = ?', [deleteID]);
    if (post) {
        const currentUser = await getCurrentUser(req);
        // Check if the current user is the owner of the post
        if (post.username.toString().toLowerCase() === currentUser.username.toString().toLowerCase()) {
            //posts.splice(postIndex, 1);
            db.run('DELETE FROM posts WHERE id = ?', [deleteID]);
            res.json({ status: 'success' });
        }
    } else {
        res.status(404).json({ status: 'error', message: 'Post not found' });
    }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to update post likes
function updatePostLikes(postID, username) {
    // TODO: Increment post likes if conditions are met
    // Find the user by username
    const user = findUserByUsername(username);
    // If user exists
    if (user) {
        // Check if likedPosts array exists in the user object
        if (!user.likedPosts) {
            user.likedPosts = [];
        }
        // Find the post by postID
        const postIndex = posts.findIndex(post => post.id === postID);
        
        // If the post exists
        if (postIndex !== -1) {
            const post = posts[postIndex];

            // Check if the post is liked by the user
            const alreadyLiked = user.likedPosts.includes(postID);

            if (!alreadyLiked) {
                // If the post is not already liked, like it
                post.likes++;
                user.likedPosts.push(postID);
                return { action: 'liked', likes: post.likes };
            } else {
                // If the post is already liked, unlike it
                post.likes--;
                user.likedPosts = user.likedPosts.filter(id => id !== postID);
                return { action: 'unliked', likes: post.likes };
            }
        } 
    }
}



// Function to get all posts, sorted by latest first
async function getPosts() {
    // return posts.slice().reverse();
    try {
        let gotPosts = await db.all('SELECT * FROM posts ORDER BY timestamp DESC');
        return gotPosts;
    } catch (error) {
        console.log("there was an error in the getPosts");
    }
}

// Function to add a new post
async function addPost(title, content, user) {
    const newPost = {
        id: undefined,
        title: title,
        content: content,
        username: user,
        timestamp: new Date().toISOString(),
        likes: 0
    }
    // posts.push(newPost);
    return await db.run(
        'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
        [newPost.title, newPost.content, newPost.username, newPost.timestamp, newPost.likes]
    );
}


// ALL U TO EDIT THESE FUNCTIONS AND ROUTES ^^^


// Function to find a user by user ID
async function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    //return users.find(user => user.id === userId);
    try {
            gotId = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
            return gotId;
    }
    catch {
        console.log('There was an error in findUserById');
    }
}

// Function to get the current user from session
async function getCurrentUser(req) {
    // TODO: Return the user object if the session user ID matches
    const userId = req.session.userId;
    if (userId) {
        return await findUserById(userId);
    }
    return null; // No user found in session
}


// PROFILE STUFF


app.get('/profile', isAuthenticated, async (req, res) => {
    // TODO: Render profile page
    //find user by userid
    renderProfile(req, res);
});

// Function to render the profile page
async function renderProfile(req, res) {
    const user = await getCurrentUser(req);
    if (user) {
        // user.posts = posts.filter(post => post.username.toLowerCase() === user.username.toLowerCase());
        let currUser = await db.all('SELECT * FROM posts WHERE LOWER(username) = LOWER(?)', [user.username]);
        res.render('profile', { user, currUser });
    } else {
        res.redirect('/login');
    }
}

app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
    handleAvatar(req, res);
});

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
    const { username } = req.params;
    const avatar = generateAvatar(username.charAt(0));
    res.set('Content-Type', 'image/png');
    res.send(avatar);
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    // Steps:
    // 1. Choose a color scheme based on the letter
    // 2. Create a canvas with the specified width and height
    // 3. Draw the background color
    // 4. Draw the letter in the center
    // 5. Return the avatar as a PNG buffer
    
    const colors = ['#94B9AF', '#90A583', '#9D8420', '#942911', '#593837'];
    const colorIndex = letter.charCodeAt(0) % colors.length;
    const backgroundColor = colors[colorIndex];

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.min(width, height) * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), width / 2, height / 2);

    const buffer = canvas.toBuffer('image/png');

    return buffer;
}


// AUTH STUFF


// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Register GET route is used for error response from registration
//

app.post('/register', async (req, res) => {
    let username = req.body.username;
    let googleID = req.body.googleID;
    try {
        // TODO: Register a new user
        const newUser = await registerUser(username, googleID);
        console.log('New user registered');
        console.log("redirecting");
        res.redirect('/login');
    } catch (error) {
        console.error('Error registering user:', error.message);
        res.redirect('/register?error=' + encodeURIComponent(error.message));
    }
});

// Function to register a new user
async function registerUser(username, googleID) {
    if (await findUserByUsername(username)) {
        throw new Error('Username already exists');
    }
    return addUser(username, googleID);
}

// Function to add a new user
async function addUser(username, googleID) {
    // TODO: Create a new user object and add to users array
    console.log("google id is", googleID);
    const userInfo = {
        username: username,
        avatar_url: '', // default for now
        hashedGoogleId: googleID,
        memberSince: new Date().toISOString()
    };
    // users.push(newUser);
    try {
        let query = 'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)'
        let newUser = await db.run(query, [userInfo.username, userInfo.hashedGoogleId, userInfo.avatar_url, userInfo.memberSince]);
        console.log('new user successfully added');
        return newUser; 
    }
    catch (error) {
        console.log('could not add newUser to the database');
        console.log(error);
    }

}

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

/* app.post('/login', async (req, res) => {
    // TODO: Login a user
    console.log("recevied post request");
    const { username } = req.body;
    console.log("Received username: ", username);
    try {
        const user = await loginUser(username);
        console.log('User logged in:', user);
        req.session.loggedIn = true;
        req.session.userId = user.id;
        res.redirect('/');
    } catch (error) {
        console.error('Error logging in user:', error.message);
        res.redirect('/login?error=' + encodeURIComponent(error.message));
    }
}); */

app.get('/register', (req, res) => {
    res.render('register', { loginError: req.query.error });
});

app.get('/google', passport.authenticate('google', {
    scope: ['profile']
}));

// google auth callback
app.get('/auth/google/callback', passport.authenticate('google'), async (req, res) => {
    let googleID = req.user.id;
    googleID = crypto.createHash('sha256').update(googleID).digest('hex');
    //  if their googleid already exists in the database, just go to home
    // otherwise prompt them to make a new username
    let checkFirstTime = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [googleID]);
    if (!checkFirstTime) {
        res.render('register', { googleID, regError: req.query.error });
    } else { 
        // logging in (basically the original login code, but looking up username via the googleID)
        // maybe one day i'll make this a function...
        try {
            let findUser = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [googleID]);
            findUser = findUser.username;
            const user = await loginUser(findUser);
            req.session.loggedIn = true;
            req.session.userId = user.id;
            res.redirect('/');
        } catch (error) {
            console.error('Error logging in user:', error.message);
            res.redirect('/login?error=' + encodeURIComponent(error.message));
        }
    }
})

// Function to login a user
async function loginUser(username) {
    const user = await findUserByUsername(username);
    console.log('user is: ', user);
    if (user) {
        return user;
    } else {
        throw new Error('User not found');
    }
}

// Function to find a user by username
async function findUserByUsername(matchUser) {
    // return users.find(user => user.username.toLowerCase() === username.toLowerCase());
    try {
            gotUser = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [matchUser]);
            return gotUser;
    }
    catch {
        console.log('There was an error in findUserByUsername');
    }
}

app.get('/logout', (req, res) => {
    // TODO: Logout the user
    logoutUser(req, res);
});

app.get('/googleLogout', (req, res) => {
    res.render('loggedOut');
})

// Error route: render error page
app.get('/error', (req, res) => {
    res.render('error'); // havent made an error handlebar yet like omg page not found or oh error ahh
});

// Function to logout a user
function logoutUser(req, res) {
    // TODO: Destroy session and redirect appropriately
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.redirect('/error');
        } else {
            res.redirect('/googleLogout');
        }
    });
}