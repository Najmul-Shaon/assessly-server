require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");

const cors = require("cors");

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false; //true for live, false for sandbox

const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://assey-9d4a0.firebaseapp.com",
      "https://assey-9d4a0.web.app",
    ],
    credentials: true,
  })
);
app.use(express.json());

// db connections

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cwzf5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    // all the db connection
    const usersCollection = client.db("AssesslyDB").collection("users");
    const examsCollection = client.db("AssesslyDB").collection("exams");
    const counterCollection = client.db("AssesslyDB").collection("counter");
    const blogsCollection = client.db("AssesslyDB").collection("blogs");
    const courseCollection = client.db("AssesslyDB").collection("courses");
    const paymentsCollection = client.db("AssesslyDB").collection("payments");
    const readBlogsCollection = client.db("AssesslyDB").collection("readBlogs");
    const enrolledProductCollection = client
      .db("AssesslyDB")
      .collection("enrolledProduct");

    // jwt related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // create  blog
    app.post("/create/blog", async (req, res) => {
      const blogInfo = { ...req.body };
      const counterDoc = await counterCollection.findOne({
        id: "taskIdCounter",
      });
      const newId = counterDoc.lastBlogId + 1;
      await counterCollection.updateOne(
        {
          id: "taskIdCounter",
        },
        {
          $set: { lastBlogId: newId },
        }
      );

      blogInfo.blogId = newId;

      const result = await blogsCollection.insertOne(blogInfo);

      res.send(result);
    });

    // get all blogs
    app.get("/get/blogs", async (req, res) => {
      const { limit } = req.query;
      if (limit === "all") {
        const result = await blogsCollection.find().toArray();
        res.send(result);
      }
      if (limit === "8") {
        const result = await blogsCollection.find().limit(8).toArray();
        res.send(result);
      }
    });

    // get individual blog by blog id
    app.get("/get/blog/:id", async (req, res) => {
      const blogId = req.params.id;
      const numBlogId = parseInt(blogId);
      const query = { blogId: numBlogId };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    // create blog as read
    app.post("/blog/add/read", async (req, res) => {
      const { readBlog } = req.body;

      const result = await readBlogsCollection.insertOne(readBlog);

      res.send(result);
    });

    // check blog is already read or not by specific user email
    app.get("/is-read", async (req, res) => {
      const { id, user } = req.query;

      let isRead = false;

      const query = {
        userEmail: user,
        blogId: id,
      };

      const result = await readBlogsCollection.findOne(query);

      if (result) {
        isRead = true;
      }

      res.send({ isRead });
    });

    // delete from isRead
    app.delete("/blog/delete/read", async (req, res) => {
      const { id, user } = req.query;

      const query = { userEmail: user, blogId: id };
      const result = await readBlogsCollection.deleteOne(query);
      res.send(result);
    });

    // get read blogs for spefic user
    app.get("/blogs/read/:email", async (req, res) => {
      const { email } = req.params;
      const result = await readBlogsCollection
        .aggregate([
          {
            $match: {
              userEmail: email,
            },
          },
          {
            $addFields: {
              blogIdNum: { $toLong: "$blogId" },
            },
          },
          {
            $lookup: {
              from: "blogs",
              localField: "blogIdNum",
              foreignField: "blogId",
              as: "blogDetails",
            },
          },
          {
            $unwind: "$blogDetails",
          },
          {
            $project: {
              blogId: "$blogDetails.blogId",
              author: "$blogDetails.createdAuthor",
              title: "$blogDetails.title",
              readingTime: "$blogDetails.readingTime",
              topic: "$blogDetails.topic",
              class: "$blogDetails.class",
              readAt: "$createdAt",
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // create exam
    app.post("/create/exam", async (req, res) => {
      const examInfo = { ...req.body };

      // generate random code
      const generateUniqueCode = () => {
        // take last 6 digit from timeStamp
        const timeStamp = Date.now().toString(36).slice(-3);
        // get randomly 3 digit
        const randomString = Math.random().toString(36).slice(2, 5);

        // make unique code and return
        return timeStamp + randomString;
      };

      if (examInfo?.examType === "group") {
        // store uniqueCode
        const uniqueCode = generateUniqueCode();

        // add to examInfo
        examInfo.examCode = uniqueCode;
      }

      const counterDoc = await counterCollection.findOne({
        id: "taskIdCounter",
      });

      const newId = counterDoc.lastExamId + 1;

      await counterCollection.updateOne(
        { id: "taskIdCounter" },
        { $set: { lastExamId: newId } }
      );

      examInfo.examId = newId;

      const result = await examsCollection.insertOne(examInfo);
      res.send(result);
    });

    // get all exam to show dashboard
    app.get("/get/all-exams", async (req, res) => {
      const { type } = req.query;
      if (type === "single") {
        const query = { examType: type };
        const result = await examsCollection.find(query).toArray();
        res.send(result);
      }
      if (type === "limit") {
        const query = { examType: "single" };
        const result = await examsCollection.find(query).limit(8).toArray();
        res.send(result);
      }
      if (type === "all") {
        const result = await examsCollection.find().toArray();
        res.send(result);
      }
    });

    // get individual exam by exam id
    app.get("/get/exam/:id", async (req, res) => {
      const examId = req.params.id;
      const numExamId = parseInt(examId);
      const query = { examId: numExamId };
      const result = await examsCollection.findOne(query);
      res.send(result);
    });

    // get exams for specific user
    app.get("/get/exams/:email", async (req, res) => {
      const { email } = req.params;
      const result = await enrolledProductCollection
        .aggregate([
          {
            $match: {
              userEmail: email,
              type: "exam",
            },
          },
          {
            $addFields: {
              idNum: { $toLong: "$productId" },
            },
          },
          {
            $lookup: {
              from: "exams",
              localField: "idNum",
              foreignField: "examId",
              as: "examDetails",
            },
          },
          {
            $unwind: "$examDetails",
          },
          {
            $project: {
              trxId: "$trxId",
              paymentAt: "$createAt",
              description: "$examDetails.description",
              duration: "$examDetails.duration",
              endDate: "$examDetails.endDate",
              startDate: "$examDetails.startDate",
              examTitle: "$examDetails.examTitle",
              examTopic: "$examDetails.examTopic",
              examClass: "$examDetails.examClass",
              examType: "$examDetails.examType",
              faceCam: "$examDetails.faceCam",
              examFee: "$examDetails.fee",
              thumbnails: "$examDetails.thumbnails",
              examMarks: "$examDetails.totalMarks",
              uniqueQuestions: "$examDetails.uniqueQuestions",
              isNegativeMarks: "$examDetails.isNegativeMarks",
              negativeMark: "$examDetails.negativeMark",
              examId: "$examDetails.examId",
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // enroll group exam ::: by specific user
    app.post("/api/post/group-exam/enroll", async (req, res) => {
      const { examCode, user } = { ...req.query };

      let isFound = false;

      const queryToGetExamFromDb = {
        examCode: examCode,
      };

      // check code is valid or not
      // get exam code from db
      const examFromDb = await examsCollection.findOne(queryToGetExamFromDb);

      // if already enrolled
      const queryToCheckIsAlreadyEnrolled = {
        productId: examFromDb?.examId,
      };

      const existingExam = await enrolledProductCollection.findOne(
        queryToCheckIsAlreadyEnrolled
      );

      if (existingExam) {
        isFound = true;
        return res.send({ isFound });
      }

      // if not already existing
      const enrolledExamInfo = {
        createAt: new Date(),
        userEmail: user,
        productId: examFromDb?.examId,
        type: "exam",
      };

      if (examFromDb) {
        await enrolledProductCollection.insertOne(enrolledExamInfo);
        isFound = true;
      }
      res.send({ isFound });
    });

    // create course
    app.post("/create-course", async (req, res) => {
      const courseInfo = { ...req.body };
      const counterDoc = await counterCollection.findOne({
        id: "taskIdCounter",
      });

      const newId = counterDoc.lastCourseId + 1;
      await counterCollection.updateOne(
        { id: "taskIdCounter" },
        {
          $set: {
            lastCourseId: newId,
          },
        }
      );

      courseInfo.courseId = newId;

      const result = await courseCollection.insertOne(courseInfo);
      res.send(result);
    });

    // get all courses
    app.get("/get-all-courses", async (req, res) => {
      const { type } = req.query;

      if (type === "all") {
        const result = await courseCollection.find().toArray();
        res.send(result);
      }
      if (type === "limit") {
        const result = await courseCollection.find().limit(8).toArray();
        res.send(result);
      }
    });

    // get individual course by exam id
    app.get("/get/course/:id", async (req, res) => {
      const courseId = req.params.id;
      const numCourseId = parseInt(courseId);
      const query = { courseId: numCourseId };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    // get course for specific user
    app.get("/get/courses/:email", async (req, res) => {
      const { email } = req.params;
      const result = await enrolledProductCollection
        .aggregate([
          {
            $match: {
              userEmail: email,
              type: "course",
            },
          },
          {
            $addFields: {
              idNum: { $toLong: "$productId" },
            },
          },
          {
            $lookup: {
              from: "courses",
              localField: "idNum",
              foreignField: "courseId",
              as: "courseDetails",
            },
          },
          {
            $unwind: "$courseDetails",
          },
          {
            $project: {
              trxId: "$trxId",
              enrolledAt: "$createAt",
              class: "$courseDetails.class",
              description: "$courseDetails.courseDetails",
              examId: "$courseDetails.examId",
              fee: "$courseDetails.fee",
              subject: "$courseDetails.subjects",
              hasExam: "$courseDetails.includeExam",
              thumbnail: "$courseDetails.thumbnail",
              title: "$courseDetails.title",
              video: "$courseDetails.video",
              duration: "$courseDetails.duration",
              courseId: "$courseDetails.courseId",
            },
          },
        ])
        .toArray();
      // const result = await paymentsCollection
      //   .aggregate([
      //     {
      //       $match: {
      //         userEmail: email,
      //         status: "paid",
      //         type: "course",
      //       },
      //     },
      //     {
      //       $addFields: {
      //         idNum: { $toLong: "$id" },
      //       },
      //     },
      //     {
      //       $lookup: {
      //         from: "courses",
      //         localField: "idNum",
      //         foreignField: "courseId",
      //         as: "courseDetails",
      //       },
      //     },
      //     {
      //       $unwind: "$courseDetails",
      //     },
      //     {
      //       $project: {
      //         trxId: "$trxId",
      //         courseId: "$courseDetails.courseId",
      //         paymentAt: "$paymentAt",
      //         class: "$courseDetails.class",
      //         fee: "$courseDetails.fee",
      //         subject: "$courseDetails.subjects",
      //         hasExam: "$courseDetails.includeExam",
      //         title: "$courseDetails.title",
      //         duration: "$courseDetails.duration",
      //       },
      //     },
      //   ])
      //   .toArray();
      res.send(result);
    });

    // payment area start

    app.post("/payment", async (req, res) => {
      const { id, type } = req.body;
      // console.log("id", id, "type", type);
      let examInfo, courseInfo;
      if (type === "exam") {
        examInfo = await examsCollection.findOne({
          examId: Number(id),
        });
        // return examInfo;
      }
      if (type === "course") {
        courseInfo = await courseCollection.findOne({
          courseId: Number(id),
        });
        // return courseInfo;
      }

      const purchaseInfo = { ...req.body };

      const fee = examInfo?.fee || courseInfo?.fee;
      const trxId = new ObjectId().toString();

      const counterDoc = await counterCollection.findOne({
        id: "taskIdCounter",
      });

      const newId = counterDoc.lastPaymentId + 1;
      await counterCollection.updateOne(
        { id: "taskIdCounter" },
        {
          $set: {
            lastPaymentId: newId,
          },
        }
      );

      purchaseInfo.paymentId = newId;
      purchaseInfo.amount = fee;
      purchaseInfo.trxId = trxId;

      // console.log(purchaseInfo);
      const data = {
        total_amount: fee,
        currency: "BDT",
        tran_id: trxId,
        success_url: `http://localhost:5000/payment/success/${trxId}`,
        // success_url: `https://assessly-server.vercel.app/payment/success/${trxId}`,
        fail_url: `http://localhost:5000/payment/fail/${trxId}`,
        // fail_url: `https://assessly-server.vercel.app/payment/fail/${trxId}`,
        cancel_url: "http://localhost:5000/payment/cancel",
        // cancel_url: `https://assessly-server.vercel.app/payment/cancel/${trxId}`,
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: purchaseInfo?.type,
        product_profile: "general",
        cus_name: purchaseInfo?.userName,
        cus_email: purchaseInfo?.userEmail,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      // console.log(data);
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        // console.log("Redirecting to: ", GatewayPageURL);

        const finalPayment = {
          ...purchaseInfo,
          status: "pending",
        };
        const result = paymentsCollection.insertOne(finalPayment);
      });

      app.post("/payment/success/:trxId", async (req, res) => {
        // console.log(req.params.trxId, examId);

        const { trxId } = req.params;

        const updateResult = await paymentsCollection.updateOne(
          {
            trxId: trxId,
          },
          {
            $set: {
              status: "paid",
              modifiedAt: new Date(),
            },
          }
        );

        const getPaymentInfo = await paymentsCollection.findOne({
          trxId: trxId,
        });

        const enrolledProductInfo = {
          createAt: new Date(),
          userEmail: getPaymentInfo?.userEmail,
          productId: Number(getPaymentInfo?.id),
          type: getPaymentInfo?.type,
        };

        const insertResult = await enrolledProductCollection.insertOne(
          enrolledProductInfo
        );

        if (updateResult.modifiedCount > 0 && insertResult.insertedId) {
          res.redirect(`http://localhost:5173/payment/success/${trxId}`);
          // res.redirect(
          //   `https://assey-9d4a0.firebaseapp.com/payment/success/${trxId}`
          // );
        }
      });
      app.post("/payment/fail/:trxId", async (req, res) => {
        const { trxId } = req.params;
        const result = await paymentsCollection.updateOne(
          {
            trxId: trxId,
          },
          {
            $set: {
              status: "failed",
              modifiedAt: new Date(),
            },
          }
        );
        if (result.modifiedCount > 0) {
          // res.redirect(`http://localhost:5173/payment/failed/${trxId}`);
          res.redirect(
            `https://assey-9d4a0.firebaseapp.com/payment/failed/${trxId}`
          );
        }
      });
      app.post("/payment/cancel/:trxId", async (req, res) => {
        const { trxId } = req.params;
        const result = await paymentsCollection.updateOne(
          {
            trxId: trxId,
          },
          {
            $set: {
              status: "cancel",
              modifiedAt: new Date(),
            },
          }
        );
        if (result.modifiedCount > 0) {
          // res.redirect(`http://localhost:5173/payment/failed/${trxId}`);
          res.redirect(
            `https://assey-9d4a0.firebaseapp.com/payment/cancel/${trxId}`
          );
        }
      });
    });

    // payment area end

    // get specific payment details for specific user
    app.get("/payments/history/:email", async (req, res) => {
      const { email } = req.params;
      // console.log(email);

      const query = {
        userEmail: email,
        status: "paid",
      };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    // check is paid or not::: by product id, type and userEmail
    app.get("/check/payment", async (req, res) => {
      const { id, type, email } = req.query;
      let paid = false;
      const query = {
        userEmail: email,
        id: id,
        type: type,
        status: "paid",
      };

      const result = await paymentsCollection.findOne(query);
      if (result) {
        paid = true;
      }
      // console.log(id, type, email);
      // console.log(result);
      res.send({ paid });
    });

    //   create user #public:open to all
    app.post("/create-user", async (req, res) => {
      const user = req.body;

      // check user exist or not
      const query = { userEmail: user.userEmail };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "User already exists",
          insertedId: null,
        });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
      // console.log(user);
    });

    // get all users
    app.get("/get/all-users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get specific user info by user email
    app.get("/api/user", async (req, res) => {
      const { email } = req.query;
      const result = await usersCollection.findOne({
        userEmail: email,
      });
      res.send(result);
    });

    // update specific user info by user email
    app.patch("/api/update-user", async (req, res) => {
      const { email } = req.query;
      const updateInfo = { ...req.body };

      const result = await usersCollection.updateOne(
        { userEmail: email },
        {
          $set: {
            gender: updateInfo.gender,
            dateOfBirth: updateInfo.dateOfBirth,
            phone: updateInfo.phone,
            country: updateInfo.country,
            city: updateInfo.city,
            postalCode: updateInfo.postalCode,
            modifiedAt: String(new Date()),
          },
        }
      );

      res.send(result);
    });

    // check specific user that he/she admin or not::::: by email
    // todo: need to verify token and verify admin
    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;

      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.userRole === "admin";
      }
      res.send({ isAdmin });
    });

    // check specific user that he/she admin or not::::: by email
    // todo: need to verify token and verify admin
    app.get("/user/regular/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      let isUser = false;
      if (user) {
        isUser = user?.userRole === "user";
      }
      res.send({ isUser });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
