

/* =========================
   LOCAL FALLBACK STORAGE
========================= */

const auth = {
  currentUser: null
};

const db = {};

function getStorageKey(path) {
  return `circlo:${path}`;
}

function readCollection(path) {
  try {
    const raw = localStorage.getItem(getStorageKey(path));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Storage read failed", err);
    return [];
  }
}

function writeCollection(path, data) {
  localStorage.setItem(getStorageKey(path), JSON.stringify(data));
}

function collection(...segments) {
  return { path: segments.filter(Boolean).join("/") };
}

function doc(...segments) {
  return { path: segments.filter(Boolean).join("/") };
}

function query(collectionRef, ...constraints) {
  return { collectionRef, constraints };
}

function orderBy(field, direction) {
  return { type: "orderBy", field, direction };
}

function addDoc(collectionRef, data) {
  const items = readCollection(collectionRef.path);
  const item = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ...data
  };
  items.push(item);
  writeCollection(collectionRef.path, items);
  return Promise.resolve({ id: item.id, path: `${collectionRef.path}/${item.id}` });
}

function setDoc(docRef, data) {
  const path = docRef.path;
  localStorage.setItem(getStorageKey(path), JSON.stringify(data));
  return Promise.resolve();
}

function getDoc(docRef) {
  const path = docRef.path;
  const raw = localStorage.getItem(getStorageKey(path));
  const data = raw ? JSON.parse(raw) : null;
  return Promise.resolve({
    id: path.split("/").pop(),
    data: () => data
  });
}

function updateDoc(docRef, data) {
  const path = docRef.path;
  const current = readCollection(path);
  const next = { ...(Array.isArray(current) ? {} : current), ...data };
  localStorage.setItem(getStorageKey(path), JSON.stringify(next));
  return Promise.resolve();
}

function deleteDoc(docRef) {
  localStorage.removeItem(getStorageKey(docRef.path));
  return Promise.resolve();
}

function getDocs(collectionRef) {
  return Promise.resolve({ docs: readCollection(collectionRef.path) });
}

function onSnapshot(queryRef, callback) {
  const path = queryRef.collectionRef.path;
  let items = readCollection(path);

  if (queryRef.constraints) {
    queryRef.constraints
      .filter((entry) => entry?.type === "orderBy")
      .forEach((entry) => {
        items = [...items].sort((a, b) => {
          const left = a[entry.field] || 0;
          const right = b[entry.field] || 0;
          return entry.direction === "desc" ? right - left : left - right;
        });
      });
  }

  const snapshot = {
    empty: items.length === 0,
    forEach: (fn) => items.forEach((item) => fn({ id: item.id, data: () => item }))
  };

  callback(snapshot);
  return () => {};
}

function onAuthStateChanged() {
  return () => {};
}

function signInWithEmailAndPassword() {
  return Promise.resolve();
}

function createUserWithEmailAndPassword() {
  return Promise.resolve({ user: { uid: "local-user" } });
}

function signOut() {
  auth.currentUser = null;
  return Promise.resolve();
}

const feed =
document.getElementById("feed");

let loginMode = true;
let friendsUsersUnsub = null;
let friendsPresenceUnsub = null;
let friendsLastCount = 0;
let groupsUnsub = null;
let groupMessagesUnsub = null;
let activeGroupId = null;
let activeGroupName = null;

function setAuthScreenVisible(visible){
  const authScreen = document.getElementById("authScreen");
  if(authScreen){
    authScreen.style.display = visible ? "flex" : "none";
  }
}

window.showAuthScreen = ()=>setAuthScreenVisible(true);
window.hideAuthScreen = ()=>setAuthScreenVisible(false);

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

    auth.currentUser = {
      uid: "local-user",
      email,
      username: email.split("@")[0]
    };

  }catch(err){

    console.error(err);

    auth.currentUser = {
      uid: "local-user",
      email,
      username: email.split("@")[0]
    };

    alert(err.message);

  }

};

/* =========================
   LOGOUT
========================= */

window.logout = ()=>{

  if(typeof removePresence === "function"){
    removePresence();
  }

  signOut(auth);

};

/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth,(user)=>{

  if(user){

    setAuthScreenVisible(false);

    if(typeof loadPosts === "function"){
      loadPosts();
    }

    if(typeof loadChat === "function"){
      loadChat();
    }

    if(typeof loadTypingIndicator === "function"){
      loadTypingIndicator();
    }

    if(typeof setOnlinePresence === "function"){
      setOnlinePresence();
    }

  }else{

    setAuthScreenVisible(false);

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

window.toggleGroups = ()=>{

  const panel =
    document.getElementById("groupsPanel");

  if(!panel) return;

  panel.classList.remove("hidden");
  panel.style.display = "block";
  panel.style.opacity = "1";
  panel.style.visibility = "visible";
  loadGroups();

};

window.addEventListener("DOMContentLoaded", ()=>{
  window.toggleGroups();
});

window.createGroup = async()=>{

  const user = auth.currentUser;

  if(!user){
    alert("Please log in first to create a group.");
    return;
  }

  const nameInput =
    document.getElementById("groupNameInput");

  const descInput =
    document.getElementById("groupDescInput");

  const name =
    nameInput.value.trim();

  const description =
    descInput.value.trim();

  if(!name){
    alert("Give the group a name");
    return;
  }

  const ref = await addDoc(
    collection(db, "groups"),
    {
      name,
      description,
      creatorUid:user.uid,
      memberIds:[user.uid],
      createdAt:Date.now(),
      updatedAt:Date.now(),
      lastMessage:""
    }
  );

  nameInput.value = "";
  descInput.value = "";

  openGroupChat(ref.id, name);

};

function loadGroups(){

  const box = document.getElementById("groupList");

  if(!box) return;

  if(groupsUnsub){
    groupsUnsub();
  }

  groupsUnsub = onSnapshot(
    query(collection(db, "groups"), orderBy("createdAt", "desc")),
    (snap)=>{
      box.innerHTML = "";

      if(snap.empty){
        const empty = document.createElement("p");
        empty.className = "emptyState";
        empty.textContent = "No groups yet. Create the first one.";
        box.appendChild(empty);
        return;
      }

      snap.forEach((docu)=>{
        const group = docu.data();
        const card = document.createElement("div");
        card.className = "groupCard";
        card.dataset.groupId = docu.id;

        if(activeGroupId === docu.id){
          card.classList.add("active");
        }

        const info = document.createElement("div");
        const title = document.createElement("h4");
        title.textContent = group.name || "Untitled group";
        const desc = document.createElement("p");
        desc.textContent = group.description || "No description yet";
        info.appendChild(title);
        info.appendChild(desc);

        const button = document.createElement("button");
        button.textContent = "Open";
        button.onclick = (event)=>{
          event.stopPropagation();
          openGroupChat(docu.id, group.name || "Untitled group");
        };

        card.onclick = ()=>openGroupChat(docu.id, group.name || "Untitled group");
        card.appendChild(info);
        card.appendChild(button);
        box.appendChild(card);
      });
    }
  );

}

function openGroupChat(groupId, groupName){

  activeGroupId = groupId;
  activeGroupName = groupName;

  const section =
    document.getElementById("groupConversation");

  const title =
    document.getElementById("activeGroupTitle");

  const emptyPrompt =
    document.getElementById("groupEmptyPrompt");

  if(section){
    section.classList.remove("hidden");
  }

  if(emptyPrompt){
    emptyPrompt.classList.add("hidden");
  }

  if(title){
    title.textContent = groupName;
  }

  document.querySelectorAll(".groupCard").forEach((card)=>{
    card.classList.toggle("active", card.dataset.groupId === groupId);
  });

  loadGroupMessages();

}

function loadGroupMessages(){

  if(!activeGroupId) return;

  const box = document.getElementById("groupMessages");

  if(!box) return;

  if(groupMessagesUnsub){
    groupMessagesUnsub();
  }

  groupMessagesUnsub = onSnapshot(
    query(
      collection(db, "groups", activeGroupId, "messages"),
      orderBy("createdAt", "asc")
    ),
    (snap)=>{
      box.innerHTML = "";

      if(snap.empty){
        const empty = document.createElement("p");
        empty.className = "emptyState";
        empty.textContent = "No messages yet. Start the conversation.";
        box.appendChild(empty);
        return;
      }

      const user = auth.currentUser;

      snap.forEach((docu)=>{
        const message = docu.data();
        const item = document.createElement("div");
        item.className = `groupMessage ${message.uid === user?.uid ? "mine" : "theirs"}`;

        const sender = document.createElement("strong");
        sender.textContent = message.username || "User";

        const text = document.createElement("p");
        text.textContent = message.text;

        const time = document.createElement("span");
        time.textContent = new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit"
        });

        item.appendChild(sender);
        item.appendChild(text);
        item.appendChild(time);
        box.appendChild(item);
      });

      box.scrollTop = box.scrollHeight;
    }
  );

}

window.sendGroupMessage = async()=>{

  const user = auth.currentUser;

  if(!user){
    alert("Please log in first to send a message.");
    return;
  }

  if(!activeGroupId) return;

  const input = document.getElementById("groupChatInput");

  if(!input) return;

  const text = input.value.trim();

  if(!text) return;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.data() || {};

  await addDoc(
    collection(db, "groups", activeGroupId, "messages"),
    {
      text,
      uid:user.uid,
      username:userData.username || user.email?.split("@")[0] || "user",
      avatar:userData.avatar || `https://i.pravatar.cc/150?u=${user.uid}`,
      createdAt:Date.now()
    }
  );

  await updateDoc(doc(db, "groups", activeGroupId), {
    lastMessage:text,
    updatedAt:Date.now()
  });

  input.value = "";

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

const groupChatInput =
document.getElementById("groupChatInput");

if(groupChatInput){

  groupChatInput.addEventListener(
    "keydown",
    (event)=>{
      if(event.key === "Enter"){
        event.preventDefault();
        window.sendGroupMessage();
      }
    }
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
            class="onlineDot ${isOnline ? '' : 'offline'}"
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

      const now = Date.now();

      presenceSnap.forEach((docu)=>{
        const presenceData = docu.data() || {};

        if(
          presenceData.online === true &&
          typeof presenceData.lastSeen === "number" &&
          now - presenceData.lastSeen < 30000
        ){
          onlineUsers.push(docu.id);
        }
      });

      renderFriendsList(
        box,
        users,
        onlineUsers
      );

    }
  );

}

