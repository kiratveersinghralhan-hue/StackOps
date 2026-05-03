/* StackOps safe app shell. Core actions are handled by final-action-fix.js. */
(function(){
  'use strict';
  function $(s){return document.querySelector(s)}
  function setText(id,value){const el=document.getElementById(id); if(el) el.textContent=value;}
  document.addEventListener('DOMContentLoaded', function(){
    // Safe live-looking counters only. No fake services/posts are inserted.
    const baseOnline = 38 + Math.floor(Math.random()*26);
    setText('onlineCounter', baseOnline.toLocaleString('en-IN'));
    setText('onlinePlayers', baseOnline.toLocaleString('en-IN'));
    setText('verifiedCounter','0');
    setText('teamCounter','0');
    setText('gmvCounter','₹0');
    const live = $('#liveArenaFeed') || $('#miniFeed');
    if(live && !live.children.length){
      live.innerHTML = '<div class="feed-item">StackOps is live. Real user activity will appear here.</div>';
    }
    const status = document.querySelector('.status-tape');
    if(status && !status.dataset.safeLoaded){ status.dataset.safeLoaded='1'; }
  });
})();
