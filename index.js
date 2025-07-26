const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = 5000;

// middleware

app.use(cors());
app.use(express.json());


const {
  MongoClient,
  ServerApiVersion,
  ObjectId
} = require('mongodb');
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
    const enrollClassCollection = client.db('eduDb').collection('enrollClass');
    const submissionCollection = client.db('eduDb').collection('submission');
    const assignmentCollection = client.db('eduDb').collection('assignment');

    // user api
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.post('/user', async (req, res) => {
      const user = req.body;
      const query = {
        email: user.email,
      };
      const existingUser = await userCollection.findOne(query);
      if (existingUser)
        return res.send({
          message: 'user already exists',
          insertedId: null,
        });
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // feedback api
    app.get('/feedback', async (req, res) => {
      const result = await feedbackCollection.aggregate([{
          $lookup: {
            from: 'user',
            localField: 'studentId',
            foreignField: '_id',
            as: 'studentInfo'
          }
        },
        {
          $lookup: {
            from: 'class',
            localField: 'classId',
            foreignField: '_id',
            as: 'classInfo'
          }
        },
        {
          $project: {
            _id: 1,
            name: '$studentInfo.name',
            photoUrl: '$studentInfo.photoUrl',
            feedbackText: 1,
            title: '$classInfo.title'
          }
        }
      ]).toArray();
      res.send(result);
    });

    // class api
    app.get('/class', async (req, res) => {
      const result = await classCollection.aggregate([{
        $sort: {
          totalEnrollment: -1,
        }
      }]).limit(6).toArray();
      res.send(result);
    });

    app.get('/class/:id', async (req, res) => {
      const id = req.params.id;
      const result = await classCollection.aggregate([{
          $match: {
            _id: new ObjectId(id)
          }
        },
        {
          $lookup: {
            from: 'user',
            localField: 'teacherId',
            foreignField: '_id',
            as: 'teacher',
          }
        },
        {
          $lookup: {
            from: 'enrollClass',
            localField: '_id',
            foreignField: 'classId',
            as: 'classEnrollment',
          }
        },
        {
          $addFields: {
            totalStudent: {
              $size: '$classEnrollment'
            }
          }
        },
        {
          $project: {
            _id: 1,
            teacherName: '$teacher.name',
            teacherPhoto: '$teacher.photoUrl',
            totalStudent: 1,
            price: 1,
            description: 1,
            imageUrl: 1,
            totalEnrollment: 1,
          },
        }
      ]).toArray();
      res.send(result);
    });

    app.get('/allClasses', async (req, res) => {
      const query = {
        status: 'accepted',
      };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // totalCount api
    app.get('/totalCount', async (req, res) => {
      const totalClass = await classCollection.estimatedDocumentCount();
      const totalEnrollment = await enrollClassCollection.estimatedDocumentCount();
      const totalUser = await userCollection.estimatedDocumentCount();
      res.send({
        totalUser: totalUser,
        totalClass: totalClass,
        totalEnrollment: totalEnrollment,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({
      ping: 1
    });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', async (req, res) => res.send('server is running'));

app.listen(port, () => {
  console.log(`Listening port is ${port}`);
});