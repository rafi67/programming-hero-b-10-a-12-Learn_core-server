const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const nodemailer = require("nodemailer");
const {
  default: axios
} = require('axios');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SK);
const port = 5000;

// middleware

app.use(cors());
app.use(express.json());
app.use(express.urlencoded());

// email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.EMAIL_ADDRESS}`,
    pass: `${process.env.EMAIL_PASS}`,
  },
});

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

      if (result[0].role !== 'student') {
        res.status(403).send({
          message: 'forbidden access'
        });
        return;
      }
      req.userId = result[0]._id;
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.query.email;
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

      if (result[0].role !== 'admin') {
        res.status(403).send({
          message: 'forbidden access'
        });
        return;
      }
      req.userId = result[0]._id;
      next();
    };
    const verifyTeacher = async (req, res, next) => {
      const email = req.query.email;
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

      if (result[0].role !== 'teacher') {
        res.status(403).send({
          message: 'forbidden access'
        });
        return;
      }
      req.userId = result[0]._id;
      next();
    };

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

    // send-payment-email api
    app.get('/send-payment-email', verifyToken, async (req, res) => {
      const paymentId = new ObjectId(req.query.paymentId);

      const result = await paymentCollection.aggregate([{
          $match: {
            _id: paymentId,
          }
        },
        {
          $lookup: {
            from: 'class',
            localField: 'classId',
            foreignField: '_id',
            as: 'Class',
          }
        },
        {
          $unwind: '$Class',
        },
        {
          $lookup: {
            from: 'user',
            localField: 'userId',
            foreignField: '_id',
            as: 'User'
          }
        },
        {
          $unwind: '$User'
        },
        {
          $project: {
            _id: 1,
            transactionId: 1,
            price: 1,
            user: '$User.name',
            classTitle: '$Class.title'
          }
        }
      ]).toArray();

      const paymentInfo = {
        transactionId: result[0].transactionId,
        user: result[0].name,
        courseTitle: result[0].classTitle,
        price: result[0].price,
      };

      const emailObj = {
        from: `"learnCore email sender" ${process.env.EMAIL_ADDRESS}`,
        to: `${req.query.email}`,
        subject: 'payment confirmation',
        html: `
        <p>Thank you for the payment. We have received your payment.</p>
        <br/>
        <br/>
        <h3>Transaction Id: ${paymentInfo.transactionId}</h3>
        <br/>
        <br/>
        <p>If you face any issue, please reply to this email address</p>
        <button>Click Here</button>
        <br/>
        <br/>
        <p>Class: ${paymentInfo.courseTitle}</p>
        <p>Price: ${paymentInfo.price}</p>
        `,
      };

      try {
        const emailInfo = await transporter.sendMail(emailObj);
        res.status(200).send({
          message: 'successfully done',
          messageId: emailInfo.messageId
        });
      } catch (err) {
        res.status(500).send({
          message: err.message,
        });
      }
    });

    // user api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.aggregate([{
          $lookup: {
            from: 'role',
            localField: '_id',
            foreignField: 'userId',
            as: 'Role',
          }
        },
        {
          $unwind: {
            path: "$Role",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            photoUrl: 1,
            email: 1,
            role: '$Role.role'
          }
        },
      ]).toArray();
      res.send(result);
    })

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

    app.patch('/makeAdmin', verifyToken, verifyAdmin, async (req, res) => {
      const userId = new ObjectId(req.query.userId);
      const query = {
        userId: userId
      };
      const update = {
        $set: {
          role: 'admin'
        }
      };
      const result = await userRoleCollection.updateOne(query, update);
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

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
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

    app.post('/feedback', verifyToken, verifyStudent, async (req, res) => {
      const feedback = req.body;
      const doc = {
        studentId: req.userId,
        classId: new ObjectId(feedback.classId),
        feedbackText: feedback.feedbackText,
        rating: feedback.rating
      };
      const result = await feedbackCollection.insertOne(doc);
      let response = false;
      if (result) response = true;
      res.send({
        response
      });
    });

    app.get('/verifyFeedback', verifyToken, verifyStudent, async (req, res) => {
      const studentId = req.userId;
      const classId = req.query.classId;
      const query = {
        studentId: studentId,
        classId: new ObjectId(classId)
      };
      const result = await feedbackCollection.find(query).toArray();

      if (result.length != 0) {
        res.send(true);
        return;
      }
      res.send(false);
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

    app.get('/allClasses', async (req, res) => {
      const search = req.query.search;
      if (search) {
        const result = await classCollection.aggregate([{
            $match: {
              status: 'accepted',
              title: {
                $regex: search,
                $options: 'i'
              }
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
      } else {
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
      }
    });

    app.get('/myClass', verifyToken, verifyTeacher, async (req, res) => {
      const userId = req.userId;
      const result = await classCollection.aggregate([{
          $match: {
            teacherId: userId
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
            email: '$teacher.email',
            price: 1,
            imageUrl: 1,
            description: 1,
            status: 1
          }
        }
      ]).toArray();
      res.send(result);
    });

    app.get('/classProgress', verifyToken, verifyAdmin, async (req, res) => {
      const classId = req.query.classId;
      const result = await classCollection.aggregate([{
          $match: {
            _id: new ObjectId(classId)
          }
        },
        {
          $lookup: {
            from: 'assignment',
            localField: '_id',
            foreignField: 'classId',
            as: 'Assignment'
          }
        },
        {
          $addFields: {
            totalAssignment: {
              $size: '$Assignment'
            }
          }
        },
        {
          $lookup: {
            from: 'submission',
            localField: 'Assignment._id',
            foreignField: '_id',
            as: 'Submission'
          }
        },
        {
          $addFields: {
            totalSubmission: {
              $size: '$Submission'
            }
          }
        },
        {
          $project: {
            _id: 1,
            totalEnrollment: 1,
            totalAssignment: 1,
            totalSubmission: 1,
          }
        },
      ]).toArray();

      res.send(result);
    });

    app.get('/myClassProgress', verifyToken, verifyTeacher, async (req, res) => {
      const classId = req.query.classId;
      const result = await classCollection.aggregate([{
          $match: {
            _id: new ObjectId(classId)
          }
        },
        {
          $lookup: {
            from: 'assignment',
            localField: '_id',
            foreignField: 'classId',
            as: 'Assignment'
          }
        },
        {
          $addFields: {
            totalAssignment: {
              $size: '$Assignment'
            }
          }
        },
        {
          $lookup: {
            from: 'submission',
            localField: 'Assignment._id',
            foreignField: '_id',
            as: 'Submission'
          }
        },
        {
          $addFields: {
            totalSubmission: {
              $size: '$Submission'
            }
          }
        },
        {
          $project: {
            _id: 1,
            totalEnrollment: 1,
            totalAssignment: 1,
            totalSubmission: 1,
          }
        },
      ]).toArray();

      res.send(result);
    });

    app.get('/allCourses', verifyToken, verifyAdmin, async (req, res) => {
      const result = await classCollection.aggregate([{
          $lookup: {
            from: 'user',
            localField: 'teacherId',
            foreignField: '_id',
            as: 'Teacher'
          }
        },
        {
          $unwind: '$Teacher'
        },
        {
          $project: {
            _id: 1,
            title: 1,
            imageUrl: 1,
            email: '$Teacher.email',
            description: 1,
            status: 1
          }
        },
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

    app.get('/myEnrollClassDetails', verifyToken, verifyStudent, async (req, res) => {
      const classId = req.query.enrollClassId;

      const result = await classCollection.aggregate([{
          $match: {
            _id: new ObjectId(classId)
          }
        },
        {
          $lookup: {
            from: 'assignment',
            localField: '_id',
            foreignField: 'classId',
            as: 'Assignment'
          }
        },
        {
          $unwind: '$Assignment'
        },
        {
          $project: {
            _id: '$Assignment._id',
            title: '$Assignment.title',
            description: '$Assignment.description',
            deadline: '$Assignment.deadline'
          }
        }
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

    app.post('/addClass', verifyToken, verifyTeacher, async (req, res) => {
      const Class = req.body;
      const teacherId = req.userId;
      const doc = {
        teacherId: teacherId,
        title: Class.title,
        price: Class.price,
        description: Class.description,
        imageUrl: Class.imageUrl,
        totalEnrollment: 0,
        status: 'pending'
      };
      const result = await classCollection.insertOne(doc);
      res.send(result);
    });

    app.patch('/updateClass', verifyToken, verifyTeacher, async (req, res) => {
      const classUpdate = req.body;
      const classId = new ObjectId(req.query.classId);
      const doc = {
        $set: {
          title: classUpdate.title,
          price: classUpdate.price,
          description: classUpdate.description,
          description: classUpdate.description,
          imageUrl: classUpdate.imageUrl
        }
      };

      const query = {
        _id: classId
      };

      const result = await classCollection.updateOne(query, doc);
      res.send(result);
    });

    app.patch('/classStatus', verifyToken, verifyAdmin, async (req, res) => {
      const classId = req.query.classId;
      const status = req.body.status;
      const query = {
        _id: new ObjectId(classId)
      };
      const update = {
        $set: {
          status: status
        }
      };
      const result = await classCollection.updateOne(query, update);
      res.send(result);
    });

    app.patch('/teacherStatus', verifyToken, verifyAdmin, async (req, res) => {
      const status = req.body.status;
      const teacherId = new ObjectId(req.query.teacherId);
      const query = {
        userId: teacherId
      };

      const updateDoc = {
        $set: {
          status: status
        }
      };

      const insert = {
        userId: teacherId,
        role: 'teacher'
      };

      await teacherRequestCollection.updateOne(query, updateDoc);

      let result2;

      if (status === 'accepted') {
        result2 = await userRoleCollection.insertOne(insert)
      }

      res.send(result2);
    });

    app.delete('/deleteClass/:id', verifyToken, verifyTeacher, async (req, res) => {
      const classId = req.params.id;
      const result = await classCollection.deleteOne({
        _id: new ObjectId(classId)
      });
      res.send(result);
    })

    // submission api
    app.get('/verifySubmission', verifyToken, verifyStudent, async (req, res) => {
      const studentId = req.userId;
      const classId = new ObjectId(req.query.classId);
      const query = {
        classId: classId
      };
      const query2 = {
        studentId: studentId
      };

      const assignment = await assignmentCollection.find(query).toArray();
      const submittedAssignment = await submissionCollection.find(query2).toArray();

      const dictionary = {};

      for (let i = 0; i < assignment.length; i++) {
        dictionary[assignment[i]._id.toString()] = false;
      }

      for (let i = 0; i < assignment.length; i++) {
        for (let j = 0; j < submittedAssignment.length; j++)
          if (assignment[i]._id.toString() == submittedAssignment[j].assignmentId.toString())
            dictionary[assignment[i]._id.toString()] = true;
      }

      res.send(dictionary);
    });

    app.post('/submitAssignment', verifyToken, verifyStudent, async (req, res) => {
      const studentId = req.userId;
      const assignment = req.body;
      const submit = {
        studentId: studentId,
        assignmentId: new ObjectId(assignment.assignmentId),
        Url: assignment.Url
      };
      const result = await submissionCollection.insertOne(submit);
      res.send(result);
    });

    // assignment api
    app.post('/addAssignment', verifyToken, verifyTeacher, async (req, res) => {
      const assignment = req.body;
      const query = {
        _id: new ObjectId(req.query.classId)
      }
      const classDetails = await classCollection.findOne(query);
      const data = {
        teacherId: classDetails.teacherId,
        classId: new ObjectId(req.query.classId),
        title: assignment.title,
        deadline: assignment.deadline,
        description: assignment.description
      };
      const result = await assignmentCollection.insertOne(data);
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
    app.get('/teacherRequest', verifyToken, verifyAdmin, async (req, res) => {
      const result = await teacherRequestCollection.aggregate([{
          $lookup: {
            from: 'user',
            localField: 'userId',
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
            userId: 1,
            name: '$teacher.name',
            image: '$teacher.photoUrl',
            title: 1,
            category: 1,
            experience: 1,
            status: 1
          }
        },
      ]).toArray();
      res.send(result);
    });

    app.get('/status', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await userCollection.aggregate([{
          $match: {
            email: email
          }
        },
        {
          $lookup: {
            from: 'teacherRequest',
            localField: '_id',
            foreignField: 'userId',
            as: 'teacherRequest'
          }
        },
        {
          $unwind: '$teacherRequest'
        },
        {
          $project: {
            _id: 1,
            status: '$teacherRequest.status'
          }
        }
      ]).toArray();
      res.send(result)
    });

    app.post('/teacherRequest', verifyToken, async (req, res) => {
      const request = req.body;
      const email = req.query.email;
      const user = await userCollection.findOne({
        email: email
      });
      const teacherRequest = {
        userId: user._id,
        experience: request.experience,
        title: request.title,
        category: request.category,
        status: request.status,
      };
      const result = await teacherRequestCollection.insertOne(teacherRequest);
      res.send(result);
    });

    app.patch('/anotherTeacherRequest', verifyToken, async (req, res) => {
      const status = req.body.status;
      const email = req.query.email;
      const user = await userCollection.findOne({
        email: email
      });
      const query = {
        userId: user._id
      };

      const update = {
        $set: {
          status: status
        }
      };

      const result = await teacherRequestCollection.updateOne(query, update);
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
    app.get('/myOrder', verifyToken, verifyStudent, async (req, res) => {
      const userId = req.userId;
      const result = await paymentCollection.aggregate([{
          $match: {
            userId: userId
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
          $unwind: '$Class'
        },
        {
          $lookup: {
            from: 'user',
            localField: 'Class.teacherId',
            foreignField: '_id',
            as: 'Teacher'
          }
        },
        {
          $unwind: '$Teacher'
        },
        {
          $project: {
            _id: 1,
            title: '$Class.title',
            price: '$Class.price',
            transactionId: 1,
            email: 1,
            teacherEmail: '$Teacher.email'
          }
        },
      ]).toArray();
      res.send(result);
    });

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
      const paymentData = await paymentCollection.insertOne(paymentInfo);

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

      res.send(paymentData);
    });

    app.post('/success-payment/:email/:classId', async (req, res) => {
      const paymentSuccess = req.body;
      const email = req.params.email;
      const classId = req.params.classId;
      const user = await userCollection.findOne({
        email: email
      });
      const paymentInfo = {
        userId: user._id,
        email: email,
        price: paymentSuccess.amount,
        date: paymentSuccess.tran_date,
        transactionId: paymentSuccess.tran_id,
        classId: new ObjectId(classId),
      }

      await paymentCollection.insertOne(paymentInfo);

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
        _id: paymentInfo.classId,
      });

      const enroll = {
        classId: paymentInfo.classId,
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

      const emailObj = {
        from: `"learnCore email sender" ${process.env.EMAIL_ADDRESS}`,
        to: `${paymentInfo.email}`,
        subject: 'payment confirmation',
        html: `
        <p>Thank you for the payment. We have received your payment.</p>
        <br/>
        <br/>
        <h3>Transaction Id: ${paymentInfo.transactionId}</h3>
        <br/>
        <br/>
        <p>If you face any issue, please reply to this email address</p>
        <button>Click Here</button>
        <br/>
        <br/>
        <p>Class: ${Class.title}</p>
        <p>Price: ${paymentInfo.price}</p>
        `,
      };

      try {
        await transporter.sendMail(emailObj);
      } catch (err) {
        // res.status(500).send({
        //   message: err.message,
        // });
      }

      res.redirect(`${process.env.SUCCESS_LOCAL_CLIENT_URL}`);
    });

    app.get('/verifyPayment', verifyToken, async (req, res) => {
      const email = req.query.email;
      const classId = req.query.classId;

      const query = {
        classId: new ObjectId(classId),
        email: email
      };
      const paymentData = await paymentCollection.findOne(query);

      if (paymentData) {
        res.send({
          isPaid: true,
        });
        return;
      }
      res.send({
        isPaid: false
      });
    });

    app.post('/create-ssl-payment', verifyToken, async (req, res) => {
      const paymentInfo = req.body;

      const transactionId = new ObjectId().toString();

      const initiate = {
        store_id: `${process.env.STORE_ID}`,
        store_passwd: `${process.env.STORE_PASS}`,
        total_amount: paymentInfo.price,
        currency: 'BDT',
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `${process.env.SUCCESS_LOCAL_URL}/${paymentInfo.email}/${paymentInfo.classId}`,
        fail_url: `${process.env.FAIL_LOCAL_URL}`,
        cancel_url: `${process.env.CANCEL_LOCAL_URL}`,
        ipn_url: `${process.env.IPN_LOCAL_URL}`,
        shipping_method: 'Courier',
        product_name: `Online Course: ${paymentInfo.title}`,
        product_category: 'Education',
        product_profile: 'general',
        cus_name: `${paymentInfo.name}`,
        cus_email: `${req.query.email}`,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: `${req.query.name}`,
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };

      const iniResponse = await axios({
        url: `${process.env.INITIATE_PAYMENT_URL}`,
        method: 'POST',
        data: initiate,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const gatewayUrl = iniResponse?.data?.GatewayPageURL;

      res.send({
        gatewayUrl
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