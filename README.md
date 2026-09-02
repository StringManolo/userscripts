# UserScripts

> Scripts tested on Fennec Android with ViolentMonkey extension. Should work across different setups.

<img width="720" height="807" alt="Screenshot_20260902_185103" src="https://github.com/user-attachments/assets/4947d071-41e8-4c11-adbc-e463e74be398" />


### List of Available Scripts:

##### ToastTranslatorVoice

[Copy from here](https://raw.githubusercontent.com/StringManolo/userscripts/refs/heads/main/ToastTranslatorVoice.user.js)

Translate text when selecting it. Text shows in a small toast. When the toast is clicked you will hear the word. The script searchs for a native speaker reading the word using wiktionary.org. If the audio is not found, defaults to google translate.

<img width="720" height="481" alt="Screenshot_20260902_190452" src="https://github.com/user-attachments/assets/2225d30d-770c-4970-ba48-aa28a8557704" />


  
> Settings
> 
> It translates by default to "es" spanish. You can change the language by editing the code and just replacing "es by "en" for english or any other language supported by Google Translate. 


  
> Privacy
> 
> The script do not collects any type of data. BUT The text is send to Google translator when selected to get an automated translation. Its also send to wiktionary.org when the toast is clicked to reproduce the audio, as the word needs to be send to their servers to find the audio file to reproduce. Google and Wiktionary use their own privacy rules.


---------

##### QuickTranslateInput

[Copy from here](https://raw.githubusercontent.com/StringManolo/userscripts/refs/heads/main/QuickTranslateInput.user.js)

Translate text by typing in a floating input. Double click (PC) or double tap with two fingers (mobile) on empty area to open the input. Write and press Enter to translate. The translation shows in a toast with a copy button. Tap the toast to hear the pronunciation of the translated word (native from wiktionary.org or Google TTS as fallback). The target language is persistent and saved locally.

<img width="720" height="1366" alt="Screenshot_20260902_200659" src="https://github.com/user-attachments/assets/123a1dec-6364-4e13-814f-3dd9740ab809" />


> Settings
>
> The target language can be changed via the dropdown selector next to the input. The selected language is automatically saved and persists between sessions. By default it translates to "es" (Spanish).

> Privacy
>
> The script does not collect any type of data. The text you write is sent to Google Translate to get the translation. When you tap the toast to hear the pronunciation, the translated word is sent to wiktionary.org to find a native audio file, or to Google TTS as fallback. Google and Wiktionary use their own privacy rules.
