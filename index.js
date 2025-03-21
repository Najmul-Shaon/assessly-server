require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");
const express = require("express");
const app = express();

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

    // create exam
    app.post("/create/exam", async (req, res) => {
      const examInfo = { ...req.body };

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

    // payment area start

    app.post("/payment", async (req, res) => {
      const examId = req.body.examId;
      const examInfo = await examsCollection.findOne({
        examId: parseInt(examId),
      });

      const purchaseInfo = req.body;
      console.log(examInfo?.fee);
      const examFee = examInfo?.fee;
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
      purchaseInfo.amount = examFee;
      purchaseInfo.trxId = trxId;

      // console.log(trxId);
      const data = {
        total_amount: examFee,
        currency: "BDT",
        tran_id: trxId,
        success_url: `http://localhost:5000/payment/success/${trxId}`,
        fail_url: `http://localhost:5000/payment/fail/${trxId}`,
        cancel_url: "http://localhost:3030/cancel",
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
          purchaseInfo,
          status: "pending",
        };
        const result = paymentsCollection.insertOne(finalPayment);
      });

      app.post("/payment/success/:trxId", async (req, res) => {
        // console.log(req.params.trxId, examId);

        const { trxId } = req.params;

        const result = await paymentsCollection.updateOne(
          {
            "purchaseInfo.trxId": trxId,
          },
          {
            $set: {
              status: "paid",
            },
          }
        );
        // console.log(result);
        if (result.modifiedCount > 0) {
          res.redirect(`http://localhost:5173/payment/success/${trxId}`);
        }
      });
      app.post("/payment/fail/:trxId", async (req, res) => {
        const { trxId } = req.params;
        const result = await paymentsCollection.updateOne(
          {
            "purchaseInfo.trxId": trxId,
          },
          {
            $set: {
              status: "cancel",
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(`http://localhost:5173/payment/failed/${trxId}`);
        }
      });
    });

    // payment area end

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
      console.log(user);
    });

    // get all users
    app.get("/get/all-users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // check specific user that he/she admin or not::::: by email
    // todo: need to verify token and verify admin
    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }

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
      // console.log(email);
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }

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
