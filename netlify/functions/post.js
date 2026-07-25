const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


exports.handler = async function(event) {

  const id = event.path.split("/").pop();

  try {

    const doc = await db.collection("posts").doc(id).get();


    if (!doc.exists) {
      return {
        statusCode: 404,
        body: "Post not found"
      };
    }


    const post = doc.data();


    const html = `
<!DOCTYPE html>

<html>

<head>

<title>${post.title}</title>

<meta property="og:title" content="${post.title}">
<meta property="og:description" content="${post.description}">
<meta property="og:image" content="${post.imageUrl}">
<meta property="og:type" content="article">

<meta name="twitter:card" content="summary_large_image">

</head>

<body>

<h1>${post.title}</h1>

<p>${post.description}</p>

</body>

</html>
`;


    return {
      statusCode: 200,
      headers:{
        "Content-Type":"text/html"
      },
      body:html
    };


  } catch(error){

    return {
      statusCode:500,
      body:error.message
    };

  }

};
