

/* =========================
   FIREBASE IMPORTS
========================= */

import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut

}

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {

  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  deleteDoc

}

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG
========================= */

const firebaseConfig = {

  apiKey: "AIzaSyBmomWt8PoL7rQz52N4x3y7zbEYzjxneYU",

  authDomain: "circlo-bea39.firebaseapp.com",

  projectId: "circlo-bea39",

  storageBucket: "circlo-bea39.appspot.com",

  messagingSenderId: "287380738037",

  appId: "1:287380738037:web:3b132d5e0c9fa20937dabc"

};

/* =========================
   INIT
========================= */

const app =
initializeApp(firebaseConfig);

const auth =
getAuth(app);

const db =
getFirestore(app);

const feed =
document.getElementById("feed");

let loginMode = true;
let friendsUsersUnsub = null;
let friendsPresenceUnsub = null;
let friendsLastCount = 0;

/* =========================
   AUTH MODE
========================= */

window.toggleMode = ()=>{

  loginMode = !loginMode;

  document.getElementById(
    "authTitle"
  ).innerText =

    loginMode
    ? "Login"
    : "Register";

};

/* =========================
   AUTH
========================= */

window.activeChatUser = null;

window.authAction = async()=>{

  try{

    const email =
    document.getElementById(
      "email"
    ).value.trim();

    const password =
    document.getElementById(
      "password"
    ).value.trim();

    if(!email || !password){

      alert("Fill all fields");
      return;

    }

    if(loginMode){

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    }else{

      const cred =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await setDoc(

        doc(
          db,
          "users",
          cred.user.uid
        ),

        {

          uid:cred.user.uid,

          username:
          email.split("@")[0],

          avatar:
          "https://i.pravatar.cc/150?u=" +
          cred.user.uid,

          createdAt:Date.now()

        }

      );

    }

  }catch(err){

    console.error(err);

    alert(err.message);

  }

};

/* =========================
   LOGOUT
========================= */

window.logout = ()=>{

  removePresence();

  signOut(auth);

};

/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth,(user)=>{

  if(user){

    document.getElementById(
      "authScreen"
    ).style.display = "none";

    loadPosts();

    loadChat();

    loadTypingIndicator();

    setOnlinePresence();

  }else{

    document.getElementById(
      "authScreen"
    ).style.display = "flex";

  }

});

/* =========================
   CREATE POST
========================= */

window.createPost = async()=>{

  try{

    const user =
    auth.currentUser;

    if(!user) return;

    const text =
    document.getElementById(
      "postInput"
    ).value.trim();

    if(!text){

      alert("Write something");
      return;

    }

    const snap =
    await getDoc(
      doc(db,"users",user.uid)
    );

    const userData =
    snap.data();

    await addDoc(

      collection(db,"posts"),

      {

        text,

        uid:user.uid,

        username:userData.username,

        avatar:userData.avatar,

        likes:0,

        createdAt:Date.now()

      }

    );

    document.getElementById(
      "postInput"
    ).value = "";

  }catch(err){

    console.error(err);

  }

};

/* =========================
   COMMENTS
========================= */

function renderComments(postId, postElement){

  const commentsList =
    postElement.querySelector(
      `.commentList`
    );

  if(!commentsList) return;

  onSnapshot(

    query(
      collection(
        db,
        "posts",
        postId,
        "comments"
      ),
      orderBy("createdAt", "asc")
    ),

    (snap)=>{

      commentsList.innerHTML = "";

      if(snap.empty){

        commentsList.innerHTML =
          "<p class='commentEmpty'>No comments yet. Be the first to reply.</p>";

        return;

      }

      const comments = [];

      snap.forEach((docu)=>{

        comments.push({
          id:docu.id,
          ...docu.data()
        });

      });

      comments.forEach((comment)=>{

        const item =
        document.createElement("div");

        item.className = "commentItem";

        item.innerHTML = `

          <div class="commentMeta">

            <img src="${comment.avatar || `https://i.pravatar.cc/150?u=${comment.uid || "comment"}`}" />

            <div>

              <strong>@${comment.username || "user"}</strong>
              <span>${new Date(comment.createdAt || Date.now()).toLocaleString()}</span>

            </div>

          </div>

          <p>${comment.text}</p>

        `;

        commentsList.appendChild(item);

      });

    }

  );

}

window.addComment = async(postId)=>{

  const user = auth.currentUser;

  if(!user) return;

  const input =
    document.getElementById(
      `commentInput-${postId}`
    );

  if(!input) return;

  const text = input.value.trim();

  if(!text){

    alert("Write a comment");
    return;

  }

  const userSnap =
    await getDoc(
      doc(db,"users",user.uid)
    );

  const userData = userSnap.data() || {};

  await addDoc(

    collection(db,"posts",postId,"comments"),

    {
      text,
      uid:user.uid,
      username:userData.username || user.email?.split("@")[0] || "user",
      avatar:userData.avatar || `https://i.pravatar.cc/150?u=${user.uid}`,
      createdAt:Date.now()
    }

  );

  input.value = "";

};

/* =========================
   LOAD POSTS
========================= */

function loadPosts(){

  onSnapshot(

    query(
      collection(db,"posts")
    ),

    (snap)=>{

      feed.innerHTML = "";

      const posts = [];

      snap.forEach((docu)=>{

        posts.push({

          id:docu.id,

          ...docu.data()

        });

      });

      posts.sort(
        (a,b)=>
        b.createdAt-a.createdAt
      );

      posts.forEach((post)=>{

        const div =
        document.createElement("div");

        div.className = "post";

        div.innerHTML = `

          <div class="postHeader">

            <img src="${post.avatar}" />

            <div>

              <h4>
                @${post.username}
              </h4>

            </div>

          </div>

          <div class="postBody">

            ${post.text}

          </div>

          <div class="postActions">

            <button
              onclick="likePost('${post.id}')">

              ❤️ ${post.likes || 0}

            </button>

          </div>

          <div class="commentSection">

            <div class="commentForm">

              <input
                type="text"
                id="commentInput-${post.id}"
                placeholder="Write a comment..."
                aria-label="Comment input"
              />

              <button type="button" onclick="addComment('${post.id}')" aria-label="Add comment">
                Comment
              </button>

            </div>

            <div class="commentList"></div>

          </div>

        `;

        feed.appendChild(div);

        renderComments(post.id, div);

      });

    }

  );

}

/* =========================
   LIKE POST
========================= */

window.likePost = async(id)=>{

  await updateDoc(

    doc(db,"posts",id),

    {

      likes:
      increment(1)

    }

  );

};

/* =========================
   PANELS
========================= */

window.toggleChat = ()=>{

  document
  .getElementById(
    "chatPanel"
  )
  .classList.toggle("hidden");

};

window.toggleFriends = ()=>{

  document
  .getElementById(
    "friendsPanel"
  )
  .classList.toggle("hidden");

  loadFriends();

};

window.toggleNotifications = ()=>{

  document
  .getElementById(
    "notificationPanel"
  )
  .classList.toggle("hidden");

};



/*=====inputSendBtn===*/


const sendBtn =
document.getElementById("sendBtn");

if(sendBtn){

  sendBtn.addEventListener(
    "click",
    sendMessage
  );

}



/* =========================
   SEND MESSAGE

   /*===ToggleForMessage===*/
   window.toggleDM = ()=>{
  document.getElementById("dmPanel").classList.toggle("hidden");
  loadDMList();
};

/*======================== */
window.sendMessage = async()=>{

  const user = auth.currentUser;
  if(!user || !window.activeChatUser) return;

  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if(!text) return;

  const chatId = getChatId(user.uid, window.activeChatUser);

  // 1. Save message
  await addDoc(
    collection(db, "chats", chatId, "messages"),
    {
      text,
      uid: user.uid,
      createdAt: Date.now()
    }
  );

  // 2. Update conversation (IMPORTANT)
  await setDoc(
    doc(db, "conversations", chatId),
    {
      chatId,
      users: [user.uid, window.activeChatUser],
      lastMessage: text,
      updatedAt: Date.now()
    }
  );

  input.value = "";
};

/* =========================
   TYPING SYSTEM
========================= */

let typingTimeout;

const chatInput =
document.getElementById(
  "chatInput"
);

if(chatInput){

  chatInput.addEventListener(

    "input",

    async()=>{

      const user =
      auth.currentUser;

      if(!user) return;

      await setDoc(

        doc(
          db,
          "typingStatus",
          user.uid
        ),

        {

          typing:true,

          uid:user.uid

        }

      );

      clearTimeout(
        typingTimeout
      );

      typingTimeout =
      setTimeout(async()=>{

        await deleteDoc(

          doc(
            db,
            "typingStatus",
            user.uid
          )

        );

      },1200);

    }

  );

}

/* =========================
   LOAD TYPING
========================= */
function loadDMList(){

  const user = auth.currentUser;
  if(!user) return;

  const box = document.getElementById("dmList");
  if(!box) return;

  onSnapshot(collection(db,"conversations"), (snap)=>{

    box.innerHTML = "";

    const chats = [];

    snap.forEach(docu=>{
      const data = docu.data();

      if(data.users && data.users.includes(user.uid)){
        chats.push(data);
      }
    });

    chats.sort((a,b)=>b.updatedAt - a.updatedAt);

    if(chats.length === 0){
      box.innerHTML = "<p style='padding:10px;color:#666'>No messages yet</p>";
      return;
    }

    chats.forEach(chat=>{

      const otherUid = chat.users.find(u => u !== user.uid);

      getDoc(doc(db,"users",otherUid)).then(userDoc=>{

        const u = userDoc.data();
        if(!u) return;

        const div = document.createElement("div");
        div.className = "friend";

        div.onclick = ()=>{
          window.activeChatUser = otherUid;
          toggleDM();       // close inbox
          toggleChat();     // open chat
          loadPrivateChat();
        };

        div.innerHTML = `
          <img src="${u.avatar}" />
          <div>
            <h4>@${u.username}</h4>
            <span>${chat.lastMessage || "No messages yet"}</span>
          </div>
        `;

        box.appendChild(div);
      });
    });

  });

}

/* =========================
   FRIENDS
========================= */

function renderFriendsList(box, users, onlineUsers){

  box.innerHTML = "";

  const sortedUsers =
  [...users].sort(
    (a,b)=>(a.createdAt || 0) - (b.createdAt || 0)
  );

  sortedUsers.forEach((user)=>{

    const isOnline =
    onlineUsers.includes(
      user.uid
    );

    const div =
    document.createElement("div");

    div.className = "friend";

    div.innerHTML = `

      <img src="${user.avatar}" />

      <div>

        <h4>
          @${user.username}
        </h4>

        <div class="presenceRow">

          <div
            class="onlineDot"
            style="
              background:
              ${isOnline
                ? '#00ff88'
                : '#94a3b8'};
            ">
          </div>

          <span class="presenceText">

            ${
              isOnline
              ? "Active now"
              : "Offline"
            }

          </span>

        </div>

      </div>

    `;

    box.appendChild(div);

  });

  if(sortedUsers.length > friendsLastCount){

    requestAnimationFrame(()=>{
      box.scrollTo({
        top:box.scrollHeight,
        behavior:"smooth"
      });
    });

  }

  friendsLastCount =
  sortedUsers.length;

}

function loadFriends(){

  const box =
  document.getElementById(
    "friendsList"
  );

  if(!box) return;

  if(friendsUsersUnsub){
    friendsUsersUnsub();
  }

  if(friendsPresenceUnsub){
    friendsPresenceUnsub();
  }

  friendsLastCount = 0;

  let users = [];
  let onlineUsers = [];

  friendsUsersUnsub =
  onSnapshot(
    collection(db,"users"),
    (usersSnap)=>{

      users = [];

      usersSnap.forEach((docu)=>{

        const user =
        docu.data();

        users.push({
          ...user,
          uid:user.uid || docu.id
        });

      });

      renderFriendsList(
        box,
        users,
        onlineUsers
      );

    }
  );

  friendsPresenceUnsub =
  onSnapshot(
    collection(db,"presence"),
    (presenceSnap)=>{

      onlineUsers = [];

      presenceSnap.forEach((docu)=>{
        onlineUsers.push(docu.id);
      });

      renderFriendsList(
        box,
        users,
        onlineUsers
      );

    }
  );

}

