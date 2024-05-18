const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const { createCanvas, loadImage } = require('canvas');

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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Example data for posts and users
let posts = [
    { id: 1, title: 'Sample Post', content: 'This is a sample post.', username: 'Jordan', timestamp: '2024-01-01 10:00', likes: 0 },
    { id: 2, title: 'Another Post', content: 'This is another sample post.', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0 },
];
let users = [
    { id: 1, username: 'SampleUser', avatar_url: undefined, memberSince: '2024-01-01 08:00' },
    { id: 2, username: 'AnotherUser', avatar_url: undefined, memberSince: '2024-01-02 09:00' },
];

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', (req, res) => {
    const posts = getPosts();
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
});

// Additional routes that you must implement

app.get('/post/:id', (req, res) => {
    // TODO: Render post detail page
});
app.post('/posts', (req, res) => {
    // TODO: Add a new post and redirect to home
    console.log(req.username);
    let newContent = req.body.content;
    let newTitle = req.body.title;
    let postUser = getCurrentUser(req).username;
    addPost(newTitle, newContent, postUser);
    res.redirect('/');
});
app.post('/like/:id', isAuthenticated, (req, res) => {
    // TODO: Update post likes
    console.log(req.body.postId);
    let likes = updatePostLikes(req.body.postId);
    res.json({
        status: 'success',
        likeCounter: likes
    }); 
});
app.post('/delete/:id', isAuthenticated, (req, res) => {
    // Delete a post if the current user is the owner
    console.log(req.body.postId);
    let deleteID = parseInt(req.body.postId);
    console.log(deleteID);
    // filters out the post to delete and recreates array
    posts = posts.filter(element =>{
        return element.id != deleteID;
    })
    // reindex all the IDs
    let updateID = 1;
    posts.forEach((element) => {
        console.log("the new updateID is", updateID);
        element.id = updateID;
        updateID++;
    })
    res.json({
        status: 'success',
    }); 
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to add a new user
function addUser(username) {
    // TODO: Create a new user object and add to users array
}

// Function to update post likes
function updatePostLikes(postID) {
    // TODO: Increment post likes if conditions are met
    const likeID = postID- 1;
    posts[likeID].likes++;
    return posts[likeID].likes;
}
// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
    const newPost = {
        id: posts.length + 1,
        title: title,
        content: content,
        username: user,
        timestamp: new Date().toISOString(),
        likes: 0
    }
    posts.push(newPost);
}


// ALL U TO EDIT THESE FUNCTIONS AND ROUTES ^^^


// Function to find a user by user ID
function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    return users.find(user => user.id === userId);
}

// Function to get the current user from session
function getCurrentUser(req) {
    // TODO: Return the user object if the session user ID matches
    const userId = req.session.userId;
    if (userId) {
        return findUserById(userId);
    }
    return null; // No user found in session
}


// PROFILE STUFF


app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
    //find user by userid
    renderProfile(req, res);
});

// Function to render the profile page
function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
    const user = getCurrentUser(req);
    if (user) {
        //const posts we have to fetch post later on
        res.render('profile', {user});
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
    console.log('image_generated')
    res.send(avatar);
}

// Function to generate an image avatar
function generateAvatar(letter, width = 40, height = 40) {
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
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

app.post('/register', (req, res) => {
    const { username } = req.body;
    try {
        // TODO: Register a new user
        const newUser = registerUser(username);
        console.log('New user registered:', newUser);
        req.session.loggedIn = true;
        req.session.userId = newUser.id;
        res.redirect('/');
    } catch (error) {
        console.error('Error registering user:', error.message);
        res.redirect('/register?error=' + encodeURIComponent(error.message));
    }
});

// Function to register a new user
function registerUser(username) {
    if (findUserByUsername(username)) {
        throw new Error('Username already exists');
    }
    const newUser = {
        id: users.length + 1,
        username: username,
        avatar_url: undefined, //default for now
        memberSince: new Date().toISOString()
    };
    users.push(newUser);
    return newUser;
}

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

app.post('/login', (req, res) => {
    // TODO: Login a user
    console.log("recevied post request");
    const { username } = req.body;
    console.log("Received username: ", username);
    try {
        const user = loginUser(username);
        console.log('User logged in:', user);
        req.session.loggedIn = true;
        req.session.userId = user.id;
        res.redirect('/');
    } catch (error) {
        console.error('Error logging in user:', error.message);
        res.redirect('/login?error=' + encodeURIComponent(error.message));
    }
});

// Function to login a user
function loginUser(username) {
    const user = findUserByUsername(username);
    if (user) {
        return user;
    } else {
        throw new Error('User not found');
    }
}

// Function to find a user by username
function findUserByUsername(username) {
    return users.find(user => user.username.toLowerCase() === username.toLowerCase());
}

app.get('/logout', (req, res) => {
    // TODO: Logout the user
    logoutUser(req, res);
});

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
            res.redirect('/login');
        }
    });
}
