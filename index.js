const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SK);
const port = 5000;

// middleware

app.use(cors());
app.use(express.json());

// security middleware
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({
      message: 'unauthorized access'
    });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: 'unauthorized access'
      });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const userRoleCollection = client.db('eduDb').collection('role');
    const feedbackCollection = client.db('eduDb').collection('feedback');
    const teacherRequestCollection = client.db('eduDb').collection('teacherRequest');
    const classCollection = client.db('eduDb').collection('class');
    const enrollClassCollection = client.db('eduDb').collection('enrollClass');
    const submissionCollection = client.db('eduDb').collection('submission');
    const assignmentCollection = client.db('eduDb').collection('assignment');
    const paymentCollection = client.db('eduDb').collection('payment');

    // security middleware
    const verifyStudent = async (req, res, next) => {
      const email = req.query.email;
      console.log('user email:', email);
      const result = await userCollection.aggregate([{
          $match: {
            email: email
          }
        },
        {
          $lookup: {
            from: 'role',
            localField: '_id',
            foreignField: 'userId',
            as: 'Role'
          }
        },
        {
          $unwind: '$Role'
        },
        {
          $project: {
            _id: 1,
            role: '$Role.role'
          }
        }
      ]).toArray();

      console.log('verify student =', result[0].role);

      if (result[0].role !== 'student') {
        res.status(403).send({
          message: 'forbidden access'
        });
        return;
      }
      req.userId = result[0]._id;
      console.log('verified user is student');
      next();
    }

    // jwt api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_KEY, {
        expiresIn: '1h'
      });
      res.send({
        token
      });
    });

    // user api
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.post('/user', verifyToken, async (req, res) => {
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

    app.get('/verifyUser/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.aggregate([{
          $match: {
            email: email,
          }
        },
        {
          $lookup: {
            from: 'role',
            localField: '_id',
            foreignField: 'userId',
            as: 'role'
          }
        },
        {
          $unwind: '$role'
        },
        {
          $project: {
            role: '$role.role',
          }
        }
      ]).toArray();
      res.send(result);
    });

    app.patch('/makeAdmin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = {
        userId: new ObjectId(id)
      };

      const updateDocument = {
        $set: {
          role: 'admin'
        }
      };
      const result = await userRoleCollection.updateOne(filter, updateDocument);
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
          $unwind: '$studentInfo'
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
          $unwind: '$classInfo'
        },
        {
          $project: {
            _id: 1,
            name: '$studentInfo.name',
            photoUrl: '$studentInfo.photoUrl',
            feedbackText: 1,
            rating: 1,
            title: '$classInfo.title'
          }
        }
      ]).toArray();
      res.send(result);
    });

    app.post('/feedback', async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    });

    // class api
    app.get('/classes', async (req, res) => {
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
          $unwind: '$teacher'
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
      const result = await classCollection.aggregate([{
          $match: {
            status: 'accepted'
          }
        },
        {
          $lookup: {
            from: 'user',
            localField: 'teacherId',
            foreignField: '_id',
            as: 'teacher'
          }
        },
        {
          $unwind: '$teacher'
        },
        {
          $project: {
            _id: 1,
            title: 1,
            name: '$teacher.name',
            price: 1,
            imageUrl: 1,
            description: 1,
            totalEnrollment: 1,
            status: 1
          }
        }
      ]).toArray();
      res.send(result);
    });

    app.get('/myEnrollClass', verifyToken, verifyStudent, async (req, res) => {
      const studentId = req.userId;

      const result = await enrollClassCollection.aggregate([{
          $match: {
            studentId: studentId
          }
        },
        {
          $lookup: {
            from: 'class',
            localField: 'classId',
            foreignField: '_id',
            as: 'Class'
          }
        },
        {
          $lookup: {
            from: 'user',
            localField: 'Class.teacherId',
            foreignField: '_id',
            as: 'teacher'
          }
        },
        {
          $unwind: '$teacher'
        },
        {
          $project: {
            _id: '$Class._id',
            name: '$teacher.name',
            title: '$Class.title',
            imageUrl: '$Class.imageUrl'
          }
        },
      ]).toArray();
      
      res.send(result);
    });

    app.get('/classDetails/:id', verifyToken, async (req, res) => {
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
            as: "teacher",
          }
        },
        {
          $unwind: '$teacher'
        },
        {
          $lookup: {
            from: 'teacherRequest',
            localField: 'teacherId',
            foreignField: 'userId',
            as: 'teacherInfo'
          }
        },
        {
          $unwind: '$teacherInfo'
        },
        {
          $project: {
            _id: 1,
            name: '$teacher.name',
            photo: '$teacher.photoUrl',
            designation: '$teacherInfo.title',
            experience: '$teacherInfo.experience',
            title: 1,
            price: 1,
            imageUrl: 1,
            totalEnrollment: 1,
            description: 1,
          }
        }
      ]).toArray();
      res.send(result);
    });

    app.post('/addClass', async (req, res) => {
      const Class = req.body;
      const result = await classCollection.insertOne(Class);
      res.send(result);
    });

    // assignment api
    app.post('/addAssignment', async (req, res) => {
      const assignment = req.body;
      const result = await assignmentCollection.insertOne(assignment);
      res.send(result);
    });

    // enroll class api
    app.get('/enrollClasses/:id', verifyToken, async (req, res) => {
      const studentId = req.params.id;
      const result = await enrollClassCollection.aggregate([{
          $match: {
            studentId: new ObjectId(studentId)
          }
        },
        {
          $lookup: {
            from: 'class',
            localField: 'classId',
            foreignField: '_id',
            as: 'enrolledClass',
          }
        },
        {
          $unwind: '$enrolledClass'
        },
        {
          $lookup: {
            from: 'user',
            localField: 'teacherId',
            foreignField: '_id',
            as: 'teacher'
          }
        },
        {
          $unwind: '$teacher'
        },
        {
          $project: {
            _id: 1,
            title: '$enrolledClass.title',
            image: '$enrolledClass.imageUrl',
            teacherName: '$teacher.name',
          }
        }
      ]).toArray();
      res.send(result);
    });

    // teacher request api
    app.get('/teacherRequest', async (req, res) => {
      const query = {
        status: 'pending'
      };
      const result = await teacherRequestCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/teacherRequest', async (req, res) => {
      const request = req.body;
      const result = await teacherRequestCollection.insertOne(request);
      res.send(result);
    });

    // teacher api
    app.get('/teacher', async (req, res) => {
      const result = await teacherRequestCollection.aggregate([{
          $match: {
            status: 'accepted'
          }
        },
        {
          $lookup: {
            from: 'user',
            localField: 'userId',
            foreignField: '_id',
            as: 'teacherInfo'
          }
        },
        {
          $unwind: '$teacherInfo'
        },
        {
          $project: {
            _id: 1,
            title: 1,
            experience: 1,
            name: '$teacherInfo.name',
            photo: '$teacherInfo.photoUrl'
          }
        }
      ]).toArray();

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

    // payment api
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const {
        price
      } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      });
    });

    app.post('/payments', verifyToken, async (req, res) => {
      const payment = req.body;
      const qry = {
        email: payment.email
      };
      const user = await userCollection.findOne(qry);

      // storing payment data
      const paymentInfo = {
        userId: user._id,
        email: payment.email,
        price: payment.price,
        date: payment.date,
        transactionId: payment.transactionId,
        classId: new ObjectId(payment.classId),
      }
      await paymentCollection.insertOne(paymentInfo);

      // store role data
      const doc = {
        userId: new ObjectId(user._id),
        role: 'student'
      };

      const roleQuery = {
        userId: doc.userId
      };

      const Role = await userRoleCollection.findOne(roleQuery);

      // if no role exists then store the role data
      if (!Role) {
        await userRoleCollection.insertOne(doc);
      }

      const Class = await classCollection.findOne({
        _id: new ObjectId(payment.classId)
      });

      const enroll = {
        classId: new ObjectId(payment.classId),
        teacherId: Class.teacherId,
        studentId: user._id
      };

      await enrollClassCollection.insertOne(enroll);
      const query = {
        _id: Class._id
      };

      const updateDoc = {
        $set: {
          totalEnrollment: Class.totalEnrollment + 1
        }
      };

      await classCollection.updateOne(query, updateDoc);

      res.send({
        message: 'success'
      });
    });

    app.get('/verifyPayment', async (req, res) => {
      const email = req.query.email;
      const classId = req.query.classId;
      
      const query = {
        classId: new ObjectId(classId),
      };
      const paymentData = await paymentCollection.findOne(query);
      
      if (paymentData) {
        if (paymentData.classId.toString()===classId && paymentData.email===email) {
          res.send({
            isPaid: true
          });
          return;
        }
      }
      res.send({
        isPaid: false
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