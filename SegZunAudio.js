class SegZunAudio {

  /*
  Constructor
  */
  constructor(text) {
    this.AUDIO_LIMIT = 40;
    this.HEAD_AUDIO_LIMIT = 10;
    this.shouldPause = false;
    this.playNext = 0;
    this.isPlaying = false;
    this.text = text;
    this.audios = new Array(this.AUDIO_LIMIT);
    for (let i=0;i<this.AUDIO_LIMIT;i++) {
      this.audios[i] = new Object();
      this.audios[i].id = -1;
      this.audios[i].duration = 100;
      this.audios[i].status = "empty";
      this.audios[i].audio = null;
    }
    this.headAudios = new Array(this.HEAD_AUDIO_LIMIT);
    for (let i=0;i<this.HEAD_AUDIO_LIMIT;i++) {
      this.headAudios[i] = new Object();
      this.headAudios[i].id = -1;
      this.headAudios[i].duration = 100;
      this.headAudios[i].status = "empty";
      this.headAudios[i].audio = null;
    }
    this.mainRequest();
  }
  
  /*
  Method
    Send a HTTP request to api.tts.quest and get the audioStatusUrl.
  */
  mainRequest() {
  
    // The main stuff.
    // Created a function so I can call from setTimeout.
    // SZA stands for SegZunAudio.
    function main(SZA) {
      let req = new XMLHttpRequest();
      req.open("GET", "https://api.tts.quest/v1/zun/?text="+encodeURI(SZA.text));
      req.send();
      req.onload = (e) => {
        let jres = JSON.parse(req.response);
      
        // When 429 (Too many request), Try again later.
        if (jres.success==false && jres.errorMessage == 429) {
          setTimeout(main, 1000*jres.retryAfter, SZA);
          return;
        }
      
        // audioStatusUrl is the url of audioStatusPage.
        // In audioStatusPage, you can find the list of audios.
        SZA.audioStatusUrl = jres.audioStatusUrl + "?retry=";
        
        // Once received the audioStatusUrl, 
        // call a function to get the audioUrls.
        SZA.audioStatusRequest();
        
      };
    }
    
    // Giving "this" to use as SZA.
    main(this);
  }
  
  /*
  Method
    Send a HTTP request to api.tts.quest and get the audioUrls.
  */
  audioStatusRequest() {

    function main(SZA) {
      let req = new XMLHttpRequest();
      req.open("GET", SZA.audioStatusUrl);
      req.send();
      req.onload = (e) => {
        let jres = JSON.parse(req.response);
      
        // When audioUrls isn't ready, Try again later.
        if (jres.audioCount == -1) {
          SZA.audioStatusUrl += "0";
          setTimeout(main, 1000, SZA);
          return;
        }
      
        // At this point, the audio url may return error 404.
        // This is because the audios may not have been created yet.
        SZA.audioCount = jres.audioCount;
        SZA.audioUrls = new Array(SZA.audioCount);
        for (let i=0;i<jres.audioCount;i++) {
          SZA.audioUrls[i] = jres.audios[i].url;
        }
        
        let iEnd = Math.min(SZA.audioCount, SZA.HEAD_AUDIO_LIMIT);
        for (let i=0;i<iEnd;i++) {
          SZA.genAudio(i);
        }
        
        SZA.playFromStart()
        
      };
    }
    
    // Wait 1 sec incase URL isn't created yet.
    setTimeout(main, 1000, this);
  }
  
  /*
  Method
    Send HTTP request to tts.quest to get Audio data.
  */
  genAudio(id) {
  
    function main(id, address, audios, SZA) {
    
      // It means someone has allready created.
      if (audios[address].id == id) {
        return;
      }
    
      audios[address].status = "creating"
      audios[address].id = id;
 
      audios[address].audio = new Audio(SZA.audioUrls[id]);
      audios[address].audio.load();
      
      // It takes time to load. 
      audios[address].audio.addEventListener("loadedmetadata",function(e) {
        audios[address].duration = 1000*audios[address].audio.duration;
        audios[address].id = id;
        audios[address].status = "ready";
      });
      
      // When still creating, the server returns 404...
      audios[address].audio.addEventListener("error",function(e) { 
        audios[address] = new Object();
        audios[address].id = -1;
        audios[address].duration = 100;
        audios[address].status = "empty";
        audios[address].audio = null;
        setTimeout(main, 1000, id, address, audios, SZA);
      });
      
    }
  
    // Since you can play from the begining, 
    // the frist 10 audios won't be deleted.
    // For the rest of the audio, it will only use 40.
    // This is because chromium limits the number of Audio.
    // 40[ 10] is defined in [HEAD_]AUDIO_LIMIT.
    if (id<this.HEAD_AUDIO_LIMIT) {
      main(
        id, 
        id, 
        this.headAudios, 
        this
      );
    }
    else {
      main(
        id, 
        id%this.AUDIO_LIMIT, 
        this.audios, 
        this
      );
    }
  }  
  
  /*
  Method
    Starts playing the audio from id. RECURSIVE.
  */
  startPlayingById(id) {
  
    function main(SZA, id) {
    
      if (SZA.shouldPause) {
        SZA.shouldPause =false;
        SZA.playNext = id;
        return;
      }
      SZA.playNext = id+1;
      
      let audio = Object();
      if (id<SZA.HEAD_AUDIO_LIMIT) {
        audio = SZA.headAudios[id];
      }
      else {
        audio = SZA.audios[id%SZA.AUDIO_LIMIT];
      }
      
      if (audio.id != id) {
        audio.status = "wrongId";
        SZA.genAudio(id);
      }
      
      if (audio.status!="ready") {
        setTimeout(main, 1000, SZA, id)
        return;
      }
      
      if (id+SZA.HEAD_AUDIO_LIMIT<SZA.audioCount) {
        SZA.genAudio(id+SZA.HEAD_AUDIO_LIMIT);
      }
      
      audio.audio.play();
      
      if (id+1<SZA.audioCount) {
        let playNextAudioOnEvent = (e) => {
          audio.audio.removeEventListener('playing', playNextAudioOnEvent);
          
          // The most difficult bit. How long should you wait.
          let delay = Math.max(audio.duration -120, audio.duration *.80);
          setTimeout(main, delay, SZA, id+1)
        };
        
        audio.audio.addEventListener('playing', playNextAudioOnEvent);
      }
      else {
        SZA.isPlaying = false;
      }
      
    }
    
    main(this, id%this.audioCount);
    
  }
  
  /*
  Method
    Starts playing the audio from playNext.
  */
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    let id = this.playNext % this.audioCount;
    this.startPlayingById(id);
  }
  
  /*
  Method
    Pauses the audio. play() to resume.
  */
  pause() {
    this.shouldPause = true;
    this.isPlaying = false;
  }
  
  /*
  Method
    Plays audio from the begining
  */
  playFromStart() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.startPlayingById(0);
  }
  
}
