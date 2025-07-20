const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = 5000;

// middleware

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_KEY}@cluster0.bk0nm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // db collection
    const userCollection = client.db('eduDb').collection('user');
    const userRoleCollection = client.db('eduDb').collection('userRole');
    const feedbackCollection = client.db('eduDb').collection('feedback');
    const teacherRequestCollection = client.db('eduDb').collection('teacherRequest');
    const classCollection = client.db('eduDb').collection('class');
    const enrollClassCollection = client.db('eduDb').collection('enrollClassCollection');
    const submissionCollection = client.db('eduDb').collection('submission');
    const assignmentCollection = client.db('eduDb').collection('assignment');

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);


app.get('/', async (req, res) => res.send('server is running'));

app.listen(port, () => {
    console.log(`Listening port is ${port}`);
});