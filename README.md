# LearnCore
The server-side of this project is built using Express.js and MongoDB to provide a secure, scalable, and efficient backend for LearnCore. It serves as the core engine handling all data and API requests between the client-side and the database. The backend manages user authentication with JWT, including role-based access for students, teachers, and admins. It stores and retrieves data such as users, classes, enrollments, teacher requests, assignments, feedback, and payment transactions from MongoDB. Using Express.js, the server provides a well-structured RESTful API with routes for login, registration, class management, teacher approvals, and assignment submissions. Pagination, search functionality, and secure CRUD operations are also implemented to ensure smooth performance. This server-side architecture ensures that all actions on the front-end—like enrolling in classes, applying as a teacher, submitting assignments, or approving requests—are processed and stored reliably in the database.

## Live Link
<a href="https://learncoreserver.vercel.app/">Live</a>

## API
- <a href="https://learncoreserver.vercel.app/users">get users list</a>
- <a href="https://learncoreserver.vercel.app/user">post an user data</a>
- <a href="https://learncoreserver.vercel.app/makeAdmin">make user Admin</a>
- <a href="https://learncoreserver.vercel.app/verifyUser/:email">verifyUser</a>
- <a href="https://learncoreserver.vercel.app/users">get users details for making an user admin</a>
- <a href="https://learncoreserver.vercel.app/feedback">get student feedback</a>
- <a href="https://learncoreserver.vercel.app/feedback">add a feedback</a>
- <a href="https://learncoreserver.vercel.app/verifyFeedback">check student added feedback or not</a>
- <a href="https://learncoreserver.vercel.app/jwt">/jwt</a>
- <a href="https://learncoreserver.vercel.app/classes">show popular 6 classes in descending order</a>
- <a href="https://learncoreserver.vercel.app/allClasses">get all classes that are approved by admin</a>
- <a href="https://learncoreserver.vercel.app/myClass">get class list that are added by teacher</a>  
- <a href="https://learncoreserver.vercel.app/classProgress">get class Progress view by admin</a>  
- <a href="https://learncoreserver.vercel.app/myClassProgress">get class Progress view by teacher</a>  
- <a href="https://learncoreserver.vercel.app/allCourses">get all class only view by admin</a>  
- <a href="https://learncoreserver.vercel.app/myEnrollClass">get all class enroll by student view only student account</a>  
- <a href="https://learncoreserver.vercel.app/myEnrollClassDetails">see enroll class details</a>  
- <a href="https://learncoreserver.vercel.app/classDetails/:id">see a specific class details using class id</a>  
- <a href="https://learncoreserver.vercel.app/addClass">add a class</a>  
- <a href="https://learncoreserver.vercel.app/updateClass">update class</a>  
- <a href="https://learncoreserver.vercel.app/classStatus">update class status</a>  
- <a href="https://learncoreserver.vercel.app/teacherStatus">update teacher status</a>  
- <a href="https://learncoreserver.vercel.app/deleteClass/:id">delete a class</a>  
- <a href="https://learncoreserver.vercel.app/verifySubmission">verify assignment submission</a>  
- <a href="https://learncoreserver.vercel.app/submitAssignment">submit assignment</a>  
- <a href="https://learncoreserver.vercel.app/addAssignment">add assignment</a>  
- <a href="https://learncoreserver.vercel.app/enrollClass/:id">Enroll class</a>  
- <a href="https://learncoreserver.vercel.app/teacherRequest">get teacher request</a>  
- <a href="https://learncoreserver.vercel.app/status">get teacher request status</a>  
- <a href="https://learncoreserver.vercel.app/teacherRequest">add teacher request</a>  
- <a href="https://learncoreserver.vercel.app/anotherTeacherRequest">update teacher request status to pending</a>  
- <a href="https://learncoreserver.vercel.app/teacher">get teacher info</a>  
- <a href="https://learncoreserver.vercel.app/totalCount">get total count of user, class and enrollment</a>  
- <a href="https://learncoreserver.vercel.app/myOrder">get my order list</a>  
- <a href="https://learncoreserver.vercel.app/create-payment-intent">create payment intent</a>  
- <a href="https://learncoreserver.vercel.app/payments">after payment store payments data</a>  
- <a href="https://learncoreserver.vercel.app/verifyPayment">verify user paid or not</a>  