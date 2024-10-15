// import modules
import express from "express";
import bodyParser from "body-parser";
import pkg from 'pg';
const { Client } = pkg;

// initialize express and middleware
const app = express();
const port = 3000;
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// client setup 
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'DogBlogDB',
    password: 'RRnnFF426426!', 
    port: 5432,
});

// test connection and display result
client.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('Connection error', err.stack));

// set initial logedInUser as null
let loggedInUser = null;

// create posts array
const posts = [];

// runtime storage for users and currently logged-in user { username, password, name }
const users = []; 

// middleware to check if the user is logged in
function ensureAuthenticated(req, res, next) {
    if (loggedInUser) {
        return next();
    } else {
        res.redirect('/signin');
    }
}

// route for homepage to display all blog posts
app.get("/", async (req, res) => {
    try {
        // get all post and sort by creation date
        const getPostsQuery = 'SELECT * FROM blogs ORDER BY date_created DESC';
        const result = await client.query(getPostsQuery);

        // store fetched post
        const posts = result.rows;

        // store fetched posts with user login data
        res.render("index.ejs", { posts, loggedInUser });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send('Internal server error');
    }
});

// route to display the new post form (if needed)
app.get('/create', ensureAuthenticated, (req, res) => {
    res.render('create', { loggedInUser });
});

// route to handle the form submission for creating a post
app.post('/create', ensureAuthenticated, async (req, res) => {
    const { title, body } = req.body;
    const dateCreated = new Date().toISOString(); 

    try {
        // define the SQL query to insert a new post into the blogs table
        const insertPostQuery = `
            INSERT INTO blogs (title, body, creator_user_id, date_created) 
            VALUES ($1, $2, $3, $4)`;
        
        // execute the query, substituting the pet name as the title, description as the body, 
        // the logged-in user's ID as the creator_user_id, and the current timestamp
        await client.query(insertPostQuery, [title, body, loggedInUser.user_id, dateCreated]);
        
        // redirect to the homepage after successfully creating a post
        res.redirect('/');
    } catch (error) {
        // log any errors that occur during the process and send a 500 error response
        console.error('Error during post creation:', error);
        res.status(500).send('Internal server error');
    }
});

// route for deleting a post 
app.post('/delete-post/:DogBlogId', ensureAuthenticated, async (req, res) => {
    const { DogBlogId } = req.params;

    try {
        // delete the post from the database where the blog_id matches and the creator is the logged-in user
        const query = 'DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2';
        await client.query(query, [DogBlogId, loggedInUser.user_id]);

        // redirect to the home page after successful deletion
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).send('Internal server error');
    }
});

// route to render the edit post form
app.get('/edit/:DogBlogId', ensureAuthenticated, async (req, res) => {
    const { DogBlogId } = req.params;

    try {
        // retrieve the post from the database
        const query = 'SELECT * FROM blogs WHERE blog_id = $1';
        const result = await client.query(query, [DogBlogId]);

        if (result.rows.length > 0) {
            const post = result.rows[0];
            // render the edit view with the post data
            res.render('edit', { post }); 
        } else {
            // handle case where the post does not exist
            res.status(404).send('Post not found');
        }
    } catch (error) {
        console.error('Error fetching post for editing:', error);
        res.status(500).send('Internal server error');
    }
});

// route to handle edit post form submission
app.post('/edit/:DogBlogId', ensureAuthenticated, async (req, res) => {
    const { DogBlogId } = req.params;
    const { title, body } = req.body;

    try {
        // update the blog post in the database
        const query = 'UPDATE blogs SET title = $1, body = $2, date_created = NOW() WHERE blog_id = $3 AND creator_user_id = $4';
        await client.query(query, [title, body, DogBlogId, loggedInUser.user_id]);

        res.redirect('/'); // redirect to the home page after successful edit
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).send('Internal server error');
    }
});

// route to render the sign-up page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// route to handle user signup
app.post('/signup', async (req, res) => {
    const { username, password, name } = req.body;

    try {
        // check if username already exists in the database
        const userCheckQuery = 'SELECT * FROM users WHERE username = $1';
        // execute query with provided username
        const result = await client.query(userCheckQuery, [username]);

        // if user already exists
        if (result.rows.length > 0) {
            // display error message
            res.send('Username already taken. Please choose a different one.');
        } else {
            // insert new user into the database
            const insertUserQuery = 'INSERT INTO users (username, password, name) VALUES ($1, $2, $3)';
            await client.query(insertUserQuery, [username, password, name]);
            res.redirect('/signin');
        }
    } catch (error) {
        // log and display errors
        console.error('Error during signup:', error);
        res.status(500).send('Internal server error');
    }
});

// route to render the sign-in page
app.get('/signin', (req, res) => {
    res.render('signin');
});

// route to handle sign-in form submission
app.post('/signin', async (req, res) => {
    const { username, password } = req.body;

    try {
        // check  if username and password match an existing user
        const userCheckQuery = 'SELECT * FROM users WHERE username = $1 AND password = $2';
        const result = await client.query(userCheckQuery, [username, password]);

        // if user match is found
        if (result.rows.length > 0) {
            // store logged-in user
            loggedInUser = result.rows[0];
            res.redirect('/');
        } else {
            // if incorrect, redirect to signin page
            res.redirect('/signin');
        }
    } catch (error) {
        // log and display errors
        console.error('Error during signin:', error);
        res.status(500).send('Internal server error');
    }
});

// route to handle user logout
app.get('/logout', (req, res) => {
    // clear logged-in user
    loggedInUser = null; 
    res.redirect('/');
});

// start server and listen at port 3000
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });


