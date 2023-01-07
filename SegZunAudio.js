class SegZunAudio {

  /*
  Constructor
  */
  constructor(text) {
    this.text = text;
    this.mainRequest();
  }
  
  testCall() {
    alert(this.text);
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
        SZA.audioStatusUrl = jres.audioStatusUrl;
        
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
        if (jres.readyBefore == -1) {
          setTimeout(main, 1000, SZA);
          return;
        }
      
        // At this point, the audio url may return error 404.
        // This is because the audios may not have been created yet.
        SZA.audioCount = jres.audioCount;
        SZA.audioUrls = [SZA.audioCount];
        for (let i=0;i<jres.audioCount;i++) {
          SZA.audioUrls[i] = jres.audios[i].url;
        }
        
        //SZA.methodToCallAfterThis();
        
      };
    }
    
    // Wait 1 sec incase URL isn't created yet.
    setTimeout(main, 1000, this);
  }
  
  /*
  Method
    
  */

}
