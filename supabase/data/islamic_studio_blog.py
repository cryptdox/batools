"""
Team blog posts for Islamic Studio (used by islamic_studio_library.py).

Written for the app: Quran is cited by surah:ayah and paraphrased (no
translation is copied); hadith only from well-known narrations with their
standard numbers (Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, Jami
at-Tirmidhi, Sunan Ibn Majah). Practical advice is general and avoids points
where the madhhabs differ. A scholar should still read every post before it is
approved in batools → Blog.

Each post: (key, language, title, summary, body html, tags).
"""

POSTS = [
    # ---------------------------------------------------------------- Bangla
    ('fajr-bn', 'bn', 'ফজরের নামাজ: দিনের সবচেয়ে বরকতময় শুরু',
     'ফজরের নামাজের গুরুত্ব, কুরআন-হাদিসে এর ফজিলত, কেন অনেকের কাছে এটি কঠিন লাগে এবং নিয়মিত জাগার বাস্তব কিছু উপায়।',
     '<p>দিনের প্রথম ফরজ নামাজ ফজর। পৃথিবী যখন ঘুমে, তখন একজন মুমিন উঠে দাঁড়ায় তার রবের সামনে। এই নামাজ শুধু একটি দায়িত্ব নয়; এটি পুরো দিনের দিক ঠিক করে দেয়। যে দিন আল্লাহর সামনে দাঁড়িয়ে শুরু হয়, সেই দিনে কাজের মধ্যে, কথার মধ্যে, সিদ্ধান্তের মধ্যে একটা আলাদা প্রশান্তি থাকে।</p>'
     '<h2>কুরআনে ফজরের কথা</h2>'
     '<p>আল্লাহ তাআলা সূরা আল-ইসরায় নামাজের সময়গুলোর কথা বলার পর বিশেষভাবে ফজরের কুরআন পাঠের কথা উল্লেখ করেছেন এবং জানিয়েছেন, এই সময়ের পাঠ উপস্থিত থাকার সময়, অর্থাৎ এ সময় ফেরেশতারা উপস্থিত থাকেন (সূরা আল-ইসরা ১৭:৭৮)। ভাবুন তো, আমাদের নামাজের সাক্ষী হয়ে থাকছেন আল্লাহর ফেরেশতারা!</p>'
     '<h2>হাদিসে ফজরের ফজিলত</h2>'
     '<ul>'
     '<li><strong>আল্লাহর জিম্মা:</strong> রাসূল ﷺ বলেছেন, যে ব্যক্তি ফজরের নামাজ আদায় করে সে আল্লাহর জিম্মায় থাকে (সহীহ মুসলিম ৬৫৭)। সারা দিন আল্লাহর হেফাজতে থাকার চেয়ে বড় নিরাপত্তা আর কী হতে পারে?</li>'
     '<li><strong>দুনিয়ার চেয়ে উত্তম:</strong> ফজরের দুই রাকআত সুন্নাত দুনিয়া ও এর মধ্যে যা কিছু আছে তার চেয়ে উত্তম (সহীহ মুসলিম ৭২৫)। ফরজের মর্যাদা তাহলে কত বেশি!</li>'
     '</ul>'
     '<h2>কেন ফজর কঠিন লাগে?</h2>'
     '<p>সত্যি বলতে, ফজরের সমস্যাটা সাধারণত সকালে নয়, আগের রাতে। দেরি করে ঘুমানো, রাত জেগে মোবাইল দেখা, ঘুমের আগে ভারী খাবার—এসবের ফলেই ভোরে চোখ খুলতে চায় না। আরেকটি কারণ হলো নিয়ত দুর্বল থাকা: আমরা যদি ঘুমানোর আগে মনে মনে ঠিক না করি যে ফজরে উঠবই, তাহলে অ্যালার্ম বাজলেও হাত আপনাআপনি বন্ধ করে দেয়।</p>'
     '<h2>নিয়মিত জাগার বাস্তব উপায়</h2>'
     '<ul>'
     '<li><strong>ইশার পর দ্রুত ঘুম:</strong> রাসূল ﷺ ইশার পর অপ্রয়োজনীয় গল্প-আড্ডা পছন্দ করতেন না। রাত ১০-১১টার মধ্যে ঘুমানোর চেষ্টা করুন।</li>'
     '<li><strong>ঘুমের আগে প্রস্তুতি:</strong> অজু করে শুয়ে পড়ুন, ঘুমের দোয়া ও আয়াতুল কুরসি পড়ুন এবং ফজরে ওঠার নিয়ত করুন।</li>'
     '<li><strong>অ্যালার্ম দূরে রাখুন:</strong> ফোনটি বিছানা থেকে একটু দূরে রাখলে বন্ধ করতে উঠতেই হবে, আর উঠলে ঘুম অনেকটাই কেটে যায়।</li>'
     '<li><strong>সঙ্গী খুঁজুন:</strong> পরিবারের কেউ বা বন্ধু—একে অপরকে ফোন করে জাগিয়ে দিন। নেক কাজে সহযোগিতা আল্লাহর পছন্দ।</li>'
     '<li><strong>ছোট লক্ষ্য:</strong> প্রথমে সপ্তাহে তিন দিন, তারপর পাঁচ দিন—এভাবে ধীরে ধীরে অভ্যাস গড়ুন। একদিন মিস হলে হতাশ হবেন না, পরের দিন আবার শুরু করুন।</li>'
     '</ul>'
     '<h2>ফজরের পরের সময়টুকু</h2>'
     '<p>ফজরের পর আবার ঘুমিয়ে না পড়ে সকালের জিকির, অল্প কুরআন তিলাওয়াত, কিংবা দিনের পরিকল্পনার জন্য সময়টা ব্যবহার করুন। অনেকেই অনুভব করেন, ভোরের এই শান্ত সময়ে করা কাজে অদ্ভুত বরকত থাকে।</p>'
     '<blockquote>যে দিনের শুরু আল্লাহর সাথে, সে দিন কখনো হারিয়ে যায় না।</blockquote>'
     '<p>ইসলামিক স্টুডিওর ইবাদত ট্র্যাকারে প্রতিদিন ফজর চিহ্নিত করুন। সাপ্তাহিক চার্টে নিজের অগ্রগতি দেখুন—কয়েক সপ্তাহেই অভ্যাসটি পাকা হয়ে যাবে, ইনশাআল্লাহ।</p>',
     ['salah', 'fajr']),

    ('consistency-bn', 'bn', 'অল্প হলেও নিয়মিত আমল',
     'বড় লক্ষ্যের চেয়ে ছোট কিন্তু নিয়মিত আমল কেন আল্লাহর কাছে বেশি প্রিয়, আর কীভাবে একটি টেকসই আমলের রুটিন গড়ে তোলা যায়।',
     '<p>রমজান এলে অনেকে প্রতিদিন এক পারা কুরআন পড়েন, রাতে দীর্ঘ নামাজ পড়েন। কিন্তু রমজান শেষ হতেই সব থেমে যায়। আবার কেউ নতুন বছরে প্রতিজ্ঞা করেন—প্রতিদিন তাহাজ্জুদ, প্রতিদিন সদকা—কয়েক দিন পর ক্লান্ত হয়ে সব বাদ। সমস্যাটা আমাদের আন্তরিকতায় নয়, পরিকল্পনায়।</p>'
     '<h2>রাসূল ﷺ-এর শিক্ষা</h2>'
     '<p>রাসূল ﷺ বলেছেন, আল্লাহর কাছে সবচেয়ে প্রিয় আমল হলো যা নিয়মিত করা হয়, যদিও তা অল্প হয় (সহীহ বুখারী ৬৪৬৪, সহীহ মুসলিম ৭৮৩)। আয়েশা (রা.) বর্ণনা করেছেন, নবীজি ﷺ কোনো আমল শুরু করলে তা নিয়মিত করতেন।</p>'
     '<p>এর পেছনে গভীর হিকমত আছে। একটি নিয়মিত ছোট আমল মানুষের অন্তরকে প্রতিদিন আল্লাহর সাথে যুক্ত রাখে। আর বিরতিহীন ছোট বিন্দু জমে জমেই সাগর হয়। প্রতিদিন মাত্র এক পৃষ্ঠা কুরআন পড়লে বছরে প্রায় ৩৬৫ পৃষ্ঠা, অর্থাৎ ছয় শতাধিক পৃষ্ঠার কুরআন এক বছরেরও কম সময়ে অনেকটাই শেষ হয়ে যায়।</p>'
     '<h2>টেকসই রুটিন গড়ার কয়েকটি নীতি</h2>'
     '<ul>'
     '<li><strong>এত ছোট শুরু করুন যেন না বলা কঠিন হয়:</strong> দিনে এক পৃষ্ঠা কুরআন, প্রতি নামাজের পর তাসবিহ, ঘুমের আগে তিন কুল।</li>'
     '<li><strong>নির্দিষ্ট সময়ের সাথে জুড়ে দিন:</strong> "ফজরের পর কুরআন", "আসরের পর সন্ধ্যার জিকির"—এভাবে আমলকে কোনো নির্দিষ্ট মুহূর্তের সাথে বাঁধলে ভুলে যাওয়ার সম্ভাবনা কমে।</li>'
     '<li><strong>ধারা ভাঙলে আবার শুরু:</strong> একদিন বাদ পড়লে পুরো পরিকল্পনা বাদ দেবেন না। "দুই দিন টানা বাদ দেব না"—এই নিয়মটি খুব কাজের।</li>'
     '<li><strong>ধীরে বাড়ান:</strong> এক মাস নিয়মিত থাকার পর পরিমাণ সামান্য বাড়ান। শরীর ও মন যত সহজে নেয়, আমল তত দীর্ঘস্থায়ী হয়।</li>'
     '<li><strong>নিয়ত তাজা রাখুন:</strong> আমল যেন যান্ত্রিক না হয়ে যায়। মাঝে মাঝে মনে করুন, কার জন্য করছি।</li>'
     '</ul>'
     '<h2>উদাহরণ: একটি সহজ দৈনিক তালিকা</h2>'
     '<ul><li>পাঁচ ওয়াক্ত নামাজ সময়মতো</li><li>কুরআন: ১-২ পৃষ্ঠা অর্থসহ</li><li>সকাল-সন্ধ্যার জিকির</li><li>প্রতিদিন কাউকে একটি ভালো কাজ বা সামান্য সদকা</li></ul>'
     '<blockquote>ছোট শুরু করুন, কিন্তু থামবেন না।</blockquote>'
     '<p>ইবাদত ট্র্যাকারে প্রতিটি আমলের জন্য নিজের লক্ষ্য ঠিক করুন, আর সাপ্তাহিক চার্টে দেখুন কতটা ধারাবাহিক থাকছেন। ধারাবাহিকতাই আসল বিজয়।</p>',
     ['habits', 'tazkiyah']),

    ('dhikr-bn', 'bn', 'সকাল-সন্ধ্যার জিকির: অন্তরের প্রশান্তি',
     'জিকির কী, কেন প্রয়োজন, কুরআন-হাদিসের আলোকে এর ফজিলত এবং ব্যস্ত জীবনে জিকিরকে অভ্যাসে পরিণত করার উপায়।',
     '<p>আমাদের জীবনে দুশ্চিন্তার শেষ নেই—পড়াশোনা, চাকরি, সংসার, ভবিষ্যৎ। মন অস্থির হলে আমরা নানা জায়গায় প্রশান্তি খুঁজি। অথচ আল্লাহ তাআলা স্পষ্ট জানিয়েছেন, জেনে রাখো, আল্লাহর স্মরণেই অন্তর প্রশান্ত হয় (সূরা আর-রাদ ১৩:২৮)।</p>'
     '<h2>জিকির কী?</h2>'
     '<p>জিকির মানে আল্লাহকে স্মরণ করা—মুখে, অন্তরে ও কাজে। সুবহানাল্লাহ, আলহামদুলিল্লাহ, লা ইলাহা ইল্লাল্লাহ, আল্লাহু আকবার, ইস্তিগফার, দরুদ—এসবই জিকির। কুরআন তিলাওয়াত সবচেয়ে উত্তম জিকির, আর নামাজ তো জিকিরেরই পূর্ণাঙ্গ রূপ।</p>'
     '<h2>কুরআনে জিকিরের নির্দেশ</h2>'
     '<p>আল্লাহ মুমিনদের বেশি বেশি তাঁকে স্মরণ করতে এবং সকাল-সন্ধ্যা তাঁর পবিত্রতা ঘোষণা করতে বলেছেন (সূরা আল-আহযাব ৩৩:৪১-৪২)। তিনি আরও বলেছেন, তোমরা আমাকে স্মরণ করো, আমি তোমাদের স্মরণ করব (সূরা আল-বাকারা ২:১৫২)। সৃষ্টিকর্তা নিজে আমাদের স্মরণ করবেন—এর চেয়ে বড় সম্মান কী হতে পারে!</p>'
     '<h2>একটি সহজ কিন্তু বিশাল আমল</h2>'
     '<p>রাসূল ﷺ বলেছেন, যে ব্যক্তি দিনে একশ বার "সুবহানাল্লাহি ওয়া বিহামদিহি" বলে, তার গুনাহ মাফ করে দেওয়া হয়, যদিও তা সমুদ্রের ফেনার মতো হয় (সহীহ বুখারী ৬৪০৫, সহীহ মুসলিম ২৬৯১)। একশ বার বলতে মাত্র কয়েক মিনিট লাগে—বাসের অপেক্ষায়, হাঁটতে হাঁটতে, রান্নার সময়ও বলা যায়।</p>'
     '<h2>সকাল-সন্ধ্যার জিকির কখন পড়বেন?</h2>'
     '<p>সাধারণভাবে সকালের জিকির ফজরের পর থেকে সূর্য ওঠার আগে-পরে এবং সন্ধ্যার জিকির আসরের পর থেকে মাগরিবের আশেপাশে পড়া হয়। সময় নিয়ে আলেমদের মধ্যে কিছু প্রশস্ততা আছে; মূল কথা হলো দিনের শুরু ও শেষে আল্লাহকে স্মরণ করা।</p>'
     '<h2>অভ্যাস গড়ার উপায়</h2>'
     '<ul>'
     '<li>ফজর ও আসরের পর পাঁচ-দশ মিনিট জিকিরের জন্য নির্দিষ্ট রাখুন।</li>'
     '<li>সব জিকির একবারে মুখস্থ করার চেষ্টা না করে প্রতি সপ্তাহে একটি করে যোগ করুন।</li>'
     '<li>অর্থ জেনে পড়ুন—তাহলে মুখের সাথে অন্তরও যুক্ত হবে।</li>'
     '<li>অ্যাপের দোয়া ও যিকির অংশে সকাল-সন্ধ্যার জিকির সংকলিত আছে, আর ডিজিটাল তাসবিহ দিয়ে গুনে রাখতে পারবেন।</li>'
     '</ul>'
     '<blockquote>জিহ্বা যেন আল্লাহর জিকিরে সিক্ত থাকে।</blockquote>'
     '<p>জিকির অন্তরের খাবার। শরীর যেমন খাবার ছাড়া দুর্বল হয়, অন্তরও জিকির ছাড়া শুকিয়ে যায়। আজ থেকেই সামান্য দিয়ে শুরু করুন।</p>',
     ['dhikr', 'adhkar']),

    ('character-bn', 'bn', 'উত্তম চরিত্র: হাসি থেকে কথা পর্যন্ত',
     'ইসলামে চরিত্রের স্থান কত উঁচু, রাসূল ﷺ-এর আদর্শে ছোট ছোট আচরণে কীভাবে ইসলামের সৌন্দর্য ফুটে ওঠে।',
     '<p>একজন মানুষের ইসলাম মানুষ প্রথম দেখে তার আচরণে। নামাজ, রোজা মানুষ সবসময় দেখে না; কিন্তু আমরা কীভাবে কথা বলি, কীভাবে রাগ সামলাই, কীভাবে অন্যের সাথে ব্যবহার করি—তা সবাই দেখে। তাই চরিত্র শুধু ব্যক্তিগত বিষয় নয়, এটি দাওয়াহও।</p>'
     '<h2>চরিত্রের মর্যাদা</h2>'
     '<p>রাসূল ﷺ বলেছেন, তোমাদের মধ্যে সেই উত্তম, যার চরিত্র সবচেয়ে সুন্দর (সহীহ বুখারী ৩৫৫৯)। আল্লাহ তাআলা তাঁর রাসূলের প্রশংসা করে বলেছেন, নিশ্চয়ই আপনি মহান চরিত্রের অধিকারী (সূরা আল-কালাম ৬৮:৪)।</p>'
     '<h2>প্রতিদিনের ছোট ছোট সুন্নাত</h2>'
     '<ul>'
     '<li><strong>হাসিমুখ:</strong> তোমার ভাইয়ের সামনে হাসিমুখে থাকাও সদকা (জামে তিরমিযী ১৯৫৬)। টাকা লাগে না, শুধু একটু আন্তরিকতা।</li>'
     '<li><strong>ভালো কথা অথবা চুপ থাকা:</strong> যে আল্লাহ ও শেষ দিনে বিশ্বাস করে, সে যেন ভালো কথা বলে অথবা চুপ থাকে (সহীহ বুখারী ৬০১৮, সহীহ মুসলিম ৪৭)। অনলাইনে মন্তব্য লেখার আগেও এই হাদিসটি মনে রাখা দরকার।</li>'
     '<li><strong>অন্যের জন্য ভালো চাওয়া:</strong> তোমাদের কেউ পূর্ণ মুমিন হবে না, যতক্ষণ না সে নিজের জন্য যা পছন্দ করে ভাইয়ের জন্যও তা পছন্দ করে (সহীহ বুখারী ১৩, সহীহ মুসলিম ৪৫)।</li>'
     '<li><strong>রাগ নিয়ন্ত্রণ:</strong> শক্তিশালী সে নয় যে কুস্তিতে অন্যকে হারায়; শক্তিশালী সে, যে রাগের সময় নিজেকে নিয়ন্ত্রণ করে (সহীহ বুখারী ৬১১৪, সহীহ মুসলিম ২৬০৯)।</li>'
     '</ul>'
     '<h2>পরিবারে চরিত্রের পরীক্ষা</h2>'
     '<p>বাইরে ভদ্র থাকা তুলনামূলক সহজ; আসল পরীক্ষা ঘরে। স্ত্রী-সন্তান, বাবা-মা, ভাই-বোনের সাথে আচরণেই চরিত্রের প্রকৃত রূপ বোঝা যায়। নবীজি ﷺ ঘরের কাজে সাহায্য করতেন, পরিবারের সাথে কোমল ছিলেন।</p>'
     '<h2>কীভাবে চরিত্র উন্নত করবেন</h2>'
     '<ul><li>প্রতিদিন একটি সুন্নাত আচরণ বেছে নিন এবং সারাদিন মনে রাখার চেষ্টা করুন।</li><li>রাগের মুহূর্তে চুপ থাকুন, অবস্থান বদলান, অজু করুন।</li><li>যার সাথে খারাপ ব্যবহার করেছেন, তার কাছে ক্ষমা চাইতে দেরি করবেন না।</li><li>উত্তম চরিত্রের জন্য দোয়া করুন—চরিত্র আল্লাহর দান।</li></ul>'
     '<blockquote>সুন্দর চরিত্র আমলের পাল্লা ভারী করে।</blockquote>',
     ['akhlaq', 'sunnah']),

    ('parents-bn', 'bn', 'বাবা-মায়ের প্রতি সদাচরণ: জান্নাতের সহজ পথ',
     'কুরআন ও হাদিসে বাবা-মায়ের অধিকার, বার্ধক্যে তাঁদের যত্ন, তাঁদের মৃত্যুর পরও কীভাবে সদাচরণ চালিয়ে যাওয়া যায়।',
     '<p>পৃথিবীতে এমন দুজন মানুষ আছেন, যাঁরা আমাদের জন্য নিজেদের ঘুম, আরাম, স্বপ্ন—সব বিসর্জন দিয়েছেন। আমরা যখন অসহায় শিশু ছিলাম, তাঁরা আমাদের আগলে রেখেছেন। ইসলাম তাই বাবা-মায়ের প্রতি সদাচরণকে আল্লাহর ইবাদতের ঠিক পরেই স্থান দিয়েছে।</p>'
     '<h2>কুরআনের নির্দেশ</h2>'
     '<p>আল্লাহ তাআলা আদেশ দিয়েছেন, তাঁকে ছাড়া আর কারও ইবাদত করবে না এবং বাবা-মায়ের সাথে সদ্ব্যবহার করবে। তাঁদের একজন বা উভয়ে বার্ধক্যে পৌঁছালে তাঁদের প্রতি বিরক্তিসূচক "উফ" শব্দটিও বলবে না, ধমক দেবে না, বরং সম্মানের সাথে কথা বলবে। দয়ায় তাঁদের প্রতি বিনয়ের ডানা নামিয়ে দেবে এবং দোয়া করবে: হে আমার রব, তাঁদের প্রতি দয়া করুন, যেমন তাঁরা শৈশবে আমাকে লালনপালন করেছেন (সূরা আল-ইসরা ১৭:২৩-২৪)।</p>'
     '<p>অন্য আয়াতে আল্লাহ মায়ের কষ্টের কথা বিশেষভাবে উল্লেখ করেছেন: মা কষ্টের পর কষ্ট সহ্য করে সন্তানকে গর্ভে ধারণ করেন, আর দুধ ছাড়াতে লাগে দুই বছর; তাই আল্লাহর প্রতি ও বাবা-মায়ের প্রতি কৃতজ্ঞ হতে বলা হয়েছে (সূরা লুকমান ৩১:১৪)।</p>'
     '<h2>মায়ের মর্যাদা</h2>'
     '<p>এক ব্যক্তি রাসূল ﷺ-কে জিজ্ঞেস করলেন, আমার উত্তম আচরণ পাওয়ার সবচেয়ে বেশি হকদার কে? তিনি বললেন, তোমার মা। লোকটি জিজ্ঞেস করল, তারপর কে? তিনি বললেন, তোমার মা। আবার জিজ্ঞেস করল, তারপর? বললেন, তোমার মা। তারপর বললেন, তোমার বাবা (সহীহ বুখারী ৫৯৭১, সহীহ মুসলিম ২৫৪৮)।</p>'
     '<h2>বাবার সন্তুষ্টি</h2>'
     '<p>হাদিসে এসেছে, রবের সন্তুষ্টি বাবার সন্তুষ্টিতে এবং রবের অসন্তুষ্টি বাবার অসন্তুষ্টিতে (জামে তিরমিযী ১৮৯৯)।</p>'
     '<h2>দৈনন্দিন জীবনে সদাচরণ</h2>'
     '<ul>'
     '<li><strong>কথায় নম্রতা:</strong> তাঁদের সাথে উঁচু স্বরে কথা নয়। মতের অমিল হলেও সম্মান বজায় রাখুন।</li>'
     '<li><strong>সময় দিন:</strong> ব্যস্ততার মাঝেও প্রতিদিন কিছু সময় তাঁদের সাথে কাটান, ফোন করুন, খোঁজ নিন।</li>'
     '<li><strong>প্রয়োজন পূরণ:</strong> ওষুধ, ডাক্তার, খাবার—তাঁদের প্রয়োজন চাওয়ার আগেই বোঝার চেষ্টা করুন।</li>'
     '<li><strong>বার্ধক্যে ধৈর্য:</strong> বয়স বাড়লে মানুষ শিশুর মতো হয়ে যায়; একই প্রশ্ন বারবার করেন, মেজাজ বদলায়। তখন সেই ধৈর্য দেখান, যা তাঁরা আপনার শৈশবে দেখিয়েছিলেন।</li>'
     '<li><strong>দোয়া:</strong> প্রতি নামাজে তাঁদের জন্য দোয়া করুন।</li>'
     '</ul>'
     '<h2>তাঁরা চলে গেলে</h2>'
     '<p>বাবা-মা মারা গেলেও সদাচরণের দরজা বন্ধ হয় না। তাঁদের জন্য দোয়া ও ইস্তিগফার করা, তাঁদের পক্ষ থেকে সদকা করা, তাঁদের আত্মীয় ও বন্ধুদের সাথে সম্পর্ক রাখা—সবই সদাচরণ। রাসূল ﷺ জানিয়েছেন, মানুষ মারা গেলে তার আমল বন্ধ হয়ে যায়, তিনটি ছাড়া; তার একটি হলো নেক সন্তান, যে তার জন্য দোয়া করে (সহীহ মুসলিম ১৬৩১)।</p>'
     '<blockquote>রাব্বির হামহুমা কামা রাব্বায়ানি সাগিরা।</blockquote>',
     ['family', 'parents']),

    ('patience-bn', 'bn', 'সবর: বিপদে ধৈর্য, সুখে কৃতজ্ঞতা',
     'ইসলামে সবরের অর্থ, এর তিনটি দিক, কুরআন-হাদিসে ধৈর্যশীলদের প্রতিদান এবং কঠিন সময়ে মন শক্ত রাখার উপায়।',
     '<p>জীবন কখনো সরলরেখায় চলে না। অসুস্থতা, প্রিয়জনের মৃত্যু, ব্যর্থতা, অভাব—কোনো না কোনো পরীক্ষা সবার জীবনে আসে। প্রশ্ন হলো, আমরা কীভাবে সেই পরীক্ষার মুখোমুখি হই। ইসলামের উত্তর: সবরের মাধ্যমে।</p>'
     '<h2>সবর মানে কী?</h2>'
     '<p>সবর মানে শুধু চুপচাপ সহ্য করা নয়। আলেমরা সবরকে তিন ভাগে ব্যাখ্যা করেন:</p>'
     '<ul><li><strong>আনুগত্যে সবর:</strong> নামাজ, রোজা ও অন্যান্য ইবাদত নিয়মিত পালনে লেগে থাকা।</li><li><strong>গুনাহ থেকে সবর:</strong> লোভনীয় অন্যায় থেকে নিজেকে বিরত রাখা।</li><li><strong>বিপদে সবর:</strong> কষ্টের সময় আল্লাহর ফয়সালায় অভিযোগ না করে স্থির থাকা।</li></ul>'
     '<h2>কুরআনের প্রতিশ্রুতি</h2>'
     '<p>আল্লাহ বলেছেন, তোমরা ধৈর্য ও নামাজের মাধ্যমে সাহায্য চাও; নিশ্চয়ই আল্লাহ ধৈর্যশীলদের সাথে আছেন (সূরা আল-বাকারা ২:১৫৩)। পরের আয়াতগুলোতে তিনি জানিয়েছেন, তিনি আমাদের ভয়, ক্ষুধা, সম্পদ, জীবন ও ফল-ফসলের ক্ষতি দিয়ে পরীক্ষা করবেন, আর সুসংবাদ দিয়েছেন সেই ধৈর্যশীলদের, যারা বিপদে বলে: ইন্না লিল্লাহি ওয়া ইন্না ইলাইহি রাজিউন—আমরা আল্লাহরই এবং তাঁর কাছেই ফিরে যাব (সূরা আল-বাকারা ২:১৫৫-১৫৭)।</p>'
     '<p>ধৈর্যশীলদের প্রতিদান দেওয়া হবে হিসাব ছাড়াই (সূরা আয-যুমার ৩৯:১০)। আর আল্লাহ দুবার নিশ্চয়তা দিয়েছেন: নিশ্চয়ই কষ্টের সাথে স্বস্তি আছে (সূরা আশ-শারহ ৯৪:৫-৬)।</p>'
     '<h2>মুমিনের অবস্থা আশ্চর্যজনক</h2>'
     '<p>রাসূল ﷺ বলেছেন, মুমিনের বিষয়টি আশ্চর্যজনক; তার সবকিছুই কল্যাণকর। সুখ এলে সে কৃতজ্ঞ হয়, আর তা তার জন্য কল্যাণ; বিপদ এলে সে ধৈর্য ধরে, আর তাও তার জন্য কল্যাণ (সহীহ মুসলিম ২৯৯৯)।</p>'
     '<p>আরেক হাদিসে এসেছে, প্রকৃত ধৈর্য হলো বিপদের প্রথম আঘাতের সময় (সহীহ বুখারী ১২৮৩, সহীহ মুসলিম ৯২৬)। অর্থাৎ ধাক্কা লাগার মুহূর্তেই আমাদের প্রতিক্রিয়া আসল পরীক্ষা।</p>'
     '<h2>কঠিন সময়ে যা করবেন</h2>'
     '<ul>'
     '<li>"ইন্না লিল্লাহি ওয়া ইন্না ইলাইহি রাজিউন" পড়ুন এবং আল্লাহর কাছে উত্তম বিকল্প চান।</li>'
     '<li>নামাজে দাঁড়ান। সিজদায় নিজের কষ্টের কথা আল্লাহকে বলুন।</li>'
     '<li>কাঁদা দোষের নয়; নবীজি ﷺ-ও প্রিয়জন হারিয়ে চোখের পানি ফেলেছেন। তবে মুখে এমন কথা বলবেন না যা আল্লাহর অসন্তুষ্টির কারণ হয়।</li>'
     '<li>বিশ্বস্ত মানুষের সাথে কথা বলুন, প্রয়োজনে সাহায্য নিন। সবর মানে একা কষ্ট চেপে রাখা নয়।</li>'
     '<li>মনে রাখুন, দুনিয়া স্থায়ী নয়; প্রতিটি কষ্টের বিনিময় আল্লাহর কাছে সংরক্ষিত।</li>'
     '</ul>'
     '<blockquote>ধৈর্য তিক্ত, কিন্তু এর ফল মিষ্টি।</blockquote>',
     ['sabr', 'tazkiyah']),

    ('gratitude-bn', 'bn', 'শুকরিয়া: নিয়ামত ধরে রাখার চাবি',
     'কৃতজ্ঞতা কেন নিয়ামত বাড়ায়, মানুষের প্রতি কৃতজ্ঞতা কীভাবে আল্লাহর প্রতি কৃতজ্ঞতার অংশ এবং প্রতিদিন শুকরিয়া চর্চার সহজ উপায়।',
     '<p>সকালে চোখ খুলে দেখতে পাওয়া, শ্বাস নিতে পারা, হাঁটতে পারা, এক গ্লাস বিশুদ্ধ পানি—এগুলো আমরা এত স্বাভাবিক ধরে নিই যে খেয়ালই করি না। অথচ হাসপাতালে গেলে বোঝা যায়, প্রতিটি সাধারণ জিনিসই আসলে বিশাল নিয়ামত।</p>'
     '<h2>শুকরিয়ার প্রতিশ্রুতি</h2>'
     '<p>আল্লাহ তাআলা ঘোষণা করেছেন, তোমরা যদি কৃতজ্ঞ হও, আমি অবশ্যই তোমাদের আরও বাড়িয়ে দেব; আর যদি অকৃতজ্ঞ হও, তবে আমার শাস্তি কঠোর (সূরা ইবরাহিম ১৪:৭)। তিনি আরও বলেছেন, তোমরা আমার শুকরিয়া আদায় করো, অকৃতজ্ঞ হয়ো না (সূরা আল-বাকারা ২:১৫২)।</p>'
     '<h2>শুকরিয়ার তিন স্তর</h2>'
     '<ul><li><strong>অন্তরে:</strong> স্বীকার করা যে সব নিয়ামত আল্লাহর পক্ষ থেকে।</li><li><strong>মুখে:</strong> আলহামদুলিল্লাহ বলা, আল্লাহর প্রশংসা করা।</li><li><strong>কাজে:</strong> নিয়ামতকে আল্লাহর সন্তুষ্টির পথে ব্যবহার করা—চোখ দিয়ে হারাম না দেখা, সম্পদ থেকে দান করা, শরীর দিয়ে ইবাদত করা।</li></ul>'
     '<h2>মানুষের প্রতি কৃতজ্ঞতা</h2>'
     '<p>রাসূল ﷺ বলেছেন, যে মানুষের কৃতজ্ঞতা প্রকাশ করে না, সে আল্লাহরও কৃতজ্ঞতা প্রকাশ করে না (সুনান আবি দাউদ ৪৮১১, জামে তিরমিযী ১৯৫৪)। তাই যিনি আমাদের উপকার করেন—শিক্ষক, সহকর্মী, দোকানদার, পরিবারের সদস্য—তাঁকে ধন্যবাদ জানানো, "জাযাকাল্লাহু খাইরান" বলা ইবাদতেরই অংশ।</p>'
     '<h2>তুলনার ফাঁদ</h2>'
     '<p>অকৃতজ্ঞতার বড় কারণ হলো অন্যের সাথে নিজের তুলনা। রাসূল ﷺ শিখিয়েছেন, দুনিয়ার বিষয়ে তোমার চেয়ে নিচের অবস্থায় যে আছে তার দিকে তাকাও, উপরের জনের দিকে নয়; এতে আল্লাহর নিয়ামতকে তুচ্ছ মনে হবে না (সহীহ মুসলিম ২৯৬৩)। সোশ্যাল মিডিয়ার যুগে এই শিক্ষা আরও বেশি প্রয়োজন।</p>'
     '<h2>প্রতিদিনের শুকরিয়া চর্চা</h2>'
     '<ul>'
     '<li>ঘুম থেকে উঠে প্রথম কথাটি হোক আলহামদুলিল্লাহ।</li>'
     '<li>প্রতি রাতে ঘুমের আগে দিনের তিনটি নিয়ামত মনে করুন।</li>'
     '<li>খাওয়ার পর আল্লাহর প্রশংসা করুন।</li>'
     '<li>কারও কাছ থেকে উপকার পেলে আন্তরিকভাবে ধন্যবাদ দিন এবং তার জন্য দোয়া করুন।</li>'
     '<li>নিয়ামতের অংশ অন্যের সাথে ভাগ করুন—এটাই কাজের মাধ্যমে কৃতজ্ঞতা।</li>'
     '</ul>'
     '<blockquote>যা আছে তার জন্য আলহামদুলিল্লাহ; যা নেই তার জন্য আল্লাহর ফয়সালায় সন্তুষ্টি।</blockquote>',
     ['shukr', 'tazkiyah']),

    ('tawbah-bn', 'bn', 'তওবা: ফিরে আসার দরজা সবসময় খোলা',
     'গুনাহ হয়ে গেলে হতাশা নয়, তওবা। খাঁটি তওবার শর্ত, আল্লাহর রহমতের প্রশস্ততা এবং নতুন করে শুরু করার পথ।',
     '<p>মানুষ ভুল করবে—এটাই স্বাভাবিক। ফেরেশতারা গুনাহ করেন না, কিন্তু মানুষকে আল্লাহ এমনভাবে সৃষ্টি করেছেন যে সে ভুল করে, তারপর ফিরে আসে। ইসলামের সৌন্দর্য হলো, ফিরে আসার দরজা কখনো বন্ধ হয় না, যতক্ষণ না মৃত্যু উপস্থিত হয় বা সূর্য পশ্চিম দিক থেকে ওঠে।</p>'
     '<h2>হতাশ হয়ো না</h2>'
     '<p>আল্লাহ তাআলা তাঁর সেই বান্দাদের ডেকে বলেছেন, যারা নিজেদের ওপর বাড়াবাড়ি করেছে: আল্লাহর রহমত থেকে নিরাশ হয়ো না; নিশ্চয়ই আল্লাহ সব গুনাহ ক্ষমা করেন, তিনি ক্ষমাশীল, পরম দয়ালু (সূরা আয-যুমার ৩৯:৫৩)। এই আয়াতকে অনেক আলেম কুরআনের সবচেয়ে আশাজাগানিয়া আয়াতগুলোর একটি বলেছেন।</p>'
     '<p>আল্লাহ তওবাকারীদের ভালোবাসেন (সূরা আল-বাকারা ২:২২২) এবং মুমিনদের খাঁটি তওবা—তওবাতান নাসুহা—করতে বলেছেন (সূরা আত-তাহরিম ৬৬:৮)।</p>'
     '<h2>আল্লাহর আনন্দ</h2>'
     '<p>রাসূল ﷺ একটি দৃষ্টান্ত দিয়েছেন: মরুভূমিতে এক ব্যক্তির উট খাবার-পানিসহ হারিয়ে গেল। হতাশ হয়ে সে গাছের ছায়ায় শুয়ে পড়ল। হঠাৎ চোখ খুলে দেখল উটটি সামনে দাঁড়িয়ে! তার যে আনন্দ, বান্দা তওবা করলে আল্লাহ তার চেয়েও বেশি খুশি হন (সহীহ বুখারী ৬৩০৯, সহীহ মুসলিম ২৭৪৭)।</p>'
     '<p>আরেক হাদিসে এসেছে, আদমসন্তান সবাই ভুলকারী, আর ভুলকারীদের মধ্যে উত্তম তারা, যারা তওবা করে (জামে তিরমিযী ২৪৯৯, সুনান ইবনে মাজাহ ৪২৫১)। স্বয়ং রাসূল ﷺ দিনে সত্তর বারেরও বেশি আল্লাহর কাছে ক্ষমা চাইতেন ও তওবা করতেন (সহীহ বুখারী ৬৩০৭)।</p>'
     '<h2>খাঁটি তওবার শর্ত</h2>'
     '<ul><li>গুনাহটি তৎক্ষণাৎ ছেড়ে দেওয়া।</li><li>কৃত গুনাহর জন্য অন্তরে অনুতপ্ত হওয়া।</li><li>আর না করার দৃঢ় সংকল্প করা।</li><li>গুনাহটি যদি কোনো মানুষের হকের সাথে যুক্ত হয়—যেমন কারও টাকা, সম্মানহানি—তবে তা ফিরিয়ে দেওয়া বা ক্ষমা চেয়ে নেওয়া।</li></ul>'
     '<h2>আবার যদি ভুল হয়?</h2>'
     '<p>শয়তান মানুষকে বোঝায়: "তুমি তো বারবার একই ভুল করো, তোমার তওবার কোনো মূল্য নেই।" এটি ধোঁকা। যতবার ভুল হবে, ততবার আন্তরিকভাবে ফিরে আসুন। হতাশা শয়তানের অস্ত্র, আশা মুমিনের।</p>'
     '<h2>তওবাকে সহজ করার উপায়</h2>'
     '<ul><li>প্রতিদিন নির্দিষ্ট সংখ্যায় "আস্তাগফিরুল্লাহ" পড়ুন—ইবাদত ট্র্যাকারে ইস্তিগফারের লক্ষ্য রাখতে পারেন।</li><li>যে পরিবেশ বা অভ্যাস গুনাহর দিকে টানে, তা থেকে দূরে থাকুন।</li><li>গুনাহর পর একটি নেক কাজ করুন; নেক কাজ গুনাহ মুছে দেয়।</li><li>ভালো সঙ্গী খুঁজুন, যারা আল্লাহর কথা মনে করিয়ে দেয়।</li></ul>'
     '<blockquote>দরজা খোলা, শুধু ফিরে আসার অপেক্ষা।</blockquote>',
     ['tawbah', 'tazkiyah']),

    ('sadaqah-bn', 'bn', 'সদকা: যে দান সম্পদ কমায় না',
     'সদকার ফজিলত, অল্প দানের মূল্য, টাকা ছাড়াও সদকার নানা রূপ এবং সদকায়ে জারিয়া—যে সওয়াব মৃত্যুর পরও চলতে থাকে।',
     '<p>আমরা মনে করি দান করলে সম্পদ কমে যায়। অথচ রাসূল ﷺ স্পষ্ট বলেছেন, সদকা সম্পদ কমায় না (সহীহ মুসলিম ২৫৮৮)। হিসাবের খাতায় হয়তো সংখ্যা কমে, কিন্তু বরকত বাড়ে, আর আখিরাতের সঞ্চয় জমা হয়।</p>'
     '<h2>সাতশ গুণের দৃষ্টান্ত</h2>'
     '<p>আল্লাহর পথে যারা সম্পদ ব্যয় করে, তাদের দৃষ্টান্ত একটি শস্যদানার মতো, যা থেকে সাতটি শিষ বের হয়, আর প্রতিটি শিষে একশ দানা। আল্লাহ যাকে চান আরও বাড়িয়ে দেন (সূরা আল-বাকারা ২:২৬১)। একটি দানা থেকে সাতশ—এটাই আল্লাহর বাজারের হিসাব।</p>'
     '<p>প্রকাশ্যে দান করা ভালো, তবে গোপনে অভাবীকে দেওয়া আরও উত্তম (সূরা আল-বাকারা ২:২৭১)। গোপন দান নিয়তকে খাঁটি রাখে এবং গ্রহীতার সম্মান রক্ষা করে।</p>'
     '<h2>অল্প দানও মূল্যবান</h2>'
     '<p>রাসূল ﷺ বলেছেন, অর্ধেক খেজুর দিয়ে হলেও জাহান্নাম থেকে নিজেকে বাঁচাও (সহীহ বুখারী ১৪১৭, সহীহ মুসলিম ১০১৬)। তাই "আমার তো বেশি দেওয়ার সামর্থ্য নেই" ভেবে দান থেকে বিরত থাকার কারণ নেই। প্রতিদিন দশ টাকাও নিয়মিত দেওয়া অনেক বড় আমল।</p>'
     '<h2>টাকা ছাড়াও সদকা</h2>'
     '<p>রাসূল ﷺ বলেছেন, প্রতিটি ভালো কাজই সদকা (সহীহ বুখারী ৬০২১, সহীহ মুসলিম ১০০৫)। যেমন:</p>'
     '<ul><li>হাসিমুখে কথা বলা</li><li>পথ থেকে কষ্টদায়ক জিনিস সরিয়ে দেওয়া</li><li>কাউকে পথ দেখিয়ে দেওয়া</li><li>ভালো কথা বলা, পরামর্শ দেওয়া</li><li>কাউকে কিছু শেখানো</li></ul>'
     '<h2>সদকায়ে জারিয়া</h2>'
     '<p>মানুষ মারা গেলে তার আমল বন্ধ হয়ে যায়, তিনটি ছাড়া: চলমান সদকা, এমন জ্ঞান যা থেকে মানুষ উপকৃত হয়, এবং নেক সন্তান যে তার জন্য দোয়া করে (সহীহ মুসলিম ১৬৩১)। মসজিদ বা স্কুল নির্মাণে অংশ নেওয়া, নলকূপ বসানো, কুরআন বিতরণ, গাছ লাগানো—এমন কাজের সওয়াব মৃত্যুর পরও চলতে থাকে।</p>'
     '<h2>দানের আদব</h2>'
     '<ul><li>হালাল উপার্জন থেকে দিন।</li><li>খোঁটা দেবেন না, অনুগ্রহ প্রকাশ করবেন না—এতে সওয়াব নষ্ট হয়।</li><li>প্রথমে নিকটাত্মীয় ও প্রতিবেশীর মধ্যে যারা অভাবী, তাদের কথা ভাবুন।</li><li>নিয়মিত অল্প দানের অভ্যাস করুন।</li></ul>'
     '<blockquote>যা দান করলেন, সেটাই আসলে আপনার কাছে থেকে গেল।</blockquote>',
     ['sadaqah', 'charity']),

    ('neighbours-bn', 'bn', 'প্রতিবেশীর হক: ঈমানের একটি পরীক্ষা',
     'ইসলামে প্রতিবেশীর মর্যাদা, শহুরে জীবনে প্রতিবেশীর সাথে সম্পর্ক এবং ছোট ছোট উপায়ে প্রতিবেশীর হক আদায়।',
     '<p>শহরের ফ্ল্যাটে আমরা অনেক সময় পাশের দরজার মানুষটির নামও জানি না। অথচ ইসলাম প্রতিবেশীকে এত গুরুত্ব দিয়েছে যে তা শুনলে অবাক হতে হয়।</p>'
     '<h2>উত্তরাধিকারী বানিয়ে দেওয়ার মতো</h2>'
     '<p>রাসূল ﷺ বলেছেন, জিবরাঈল (আ.) আমাকে প্রতিবেশীর ব্যাপারে এত বেশি তাগিদ দিচ্ছিলেন যে আমি ভাবলাম, তিনি হয়তো প্রতিবেশীকে উত্তরাধিকারী বানিয়ে দেবেন (সহীহ বুখারী ৬০১৪, সহীহ মুসলিম ২৬২৪)।</p>'
     '<h2>কুরআনের নির্দেশ</h2>'
     '<p>আল্লাহ তাআলা তাঁর ইবাদতের নির্দেশের সাথেই বাবা-মা, আত্মীয়, এতিম, অভাবী, নিকট প্রতিবেশী, দূরের প্রতিবেশী ও পাশের সঙ্গীর সাথে সদ্ব্যবহারের নির্দেশ দিয়েছেন (সূরা আন-নিসা ৪:৩৬)। আলেমরা বলেন, প্রতিবেশী মুসলিম হোক বা অমুসলিম, আত্মীয় হোক বা অনাত্মীয়—প্রত্যেকের নিজস্ব হক আছে।</p>'
     '<h2>কষ্ট না দেওয়া</h2>'
     '<p>রাসূল ﷺ বলেছেন, যে আল্লাহ ও শেষ দিনে বিশ্বাস করে, সে যেন তার প্রতিবেশীকে কষ্ট না দেয় (সহীহ বুখারী ৬০১৮, সহীহ মুসলিম ৪৭)। আজকের দিনে এর মানে হতে পারে:</p>'
     '<ul><li>রাতে উচ্চস্বরে গান-বাজনা বা শব্দ না করা</li><li>সিঁড়ি বা করিডোরে ময়লা না ফেলা</li><li>গাড়ি পার্কিংয়ে অন্যের পথ আটকে না রাখা</li><li>নির্মাণকাজের সময় প্রতিবেশীর সুবিধা-অসুবিধা খেয়াল রাখা</li><li>প্রতিবেশীর গোপনীয়তা রক্ষা করা</li></ul>'
     '<h2>উপকার করা</h2>'
     '<ul><li>রান্না করা খাবারের সামান্য অংশ প্রতিবেশীকে পাঠান; ঝোল একটু বাড়িয়ে দিন।</li><li>অসুস্থ হলে খোঁজ নিন, প্রয়োজনে ওষুধ বা ডাক্তারের ব্যবস্থায় সাহায্য করুন।</li><li>বিপদে পাশে দাঁড়ান, আনন্দে শুভেচ্ছা জানান।</li><li>বয়স্ক প্রতিবেশীর বাজার বা ছোটখাটো কাজে সাহায্য করুন।</li><li>সন্তানদের প্রতিবেশীর সাথে সালাম ও ভদ্র আচরণ শেখান।</li></ul>'
     '<h2>সম্পর্ক শুরু করুন</h2>'
     '<p>যদি এতদিন প্রতিবেশীর সাথে কোনো যোগাযোগ না থাকে, আজ একটি সালাম দিয়ে শুরু করুন। ঈদ বা যেকোনো উপলক্ষে সামান্য উপহার দিন। দেখবেন, একটি ছোট উদ্যোগ পুরো ভবনের পরিবেশ বদলে দিতে পারে।</p>'
     '<blockquote>ভালো প্রতিবেশী দুনিয়ার এক বড় নিয়ামত—আর ভালো প্রতিবেশী হওয়া আখিরাতের সঞ্চয়।</blockquote>',
     ['neighbours', 'akhlaq']),

    # ---------------------------------------------------------------- English
    ('intentions-en', 'en', 'Intentions: the start of every deed',
     'Why the intention behind an act matters, how ordinary things become worship, and how to keep your intention sincere through the day.',
     '<p>The collection of Imam al-Bukhari, the most trusted book of hadith, opens with a short sentence that scholars have called a third of the religion: actions are judged by their intentions, and each person will have what they intended (Sahih al-Bukhari 1, Sahih Muslim 1907).</p>'
     '<p>Two people can do exactly the same thing, pray the same prayer, give the same amount, and earn completely different rewards. What makes the difference is invisible: the intention in the heart.</p>'
     '<h2>The full hadith</h2>'
     '<p>The Prophet ﷺ went on to give an example from his own time. Whoever migrated to Madinah for the sake of Allah and His Messenger, his migration was for Allah and His Messenger. But whoever migrated for some worldly gain, or to marry a woman, his migration was for what he migrated for. The outward act, a long and dangerous journey, was the same. The value was not.</p>'
     '<h2>Turning everyday life into worship</h2>'
     '<p>This hadith is also good news. Ordinary, unavoidable parts of life can become acts of worship when they are done with a good intention:</p>'
     '<ul>'
     '<li><strong>Eating and sleeping</strong>, to stay strong for prayer and for serving others.</li>'
     '<li><strong>Working</strong>, to provide halal income for your family and avoid asking others.</li>'
     '<li><strong>Studying</strong>, to benefit the Muslim community and humanity.</li>'
     '<li><strong>Exercising</strong>, to look after the body Allah entrusted to you.</li>'
     '<li><strong>Being kind at home</strong>, because the Prophet ﷺ was the best to his family.</li>'
     '</ul>'
     '<h2>Guarding the intention</h2>'
     '<p>Sincerity is not a one-time decision; it has to be renewed. Showing off can creep into even the best deeds, especially in an age of posting everything online. Some simple habits help:</p>'
     '<ul>'
     '<li><strong>Pause before you begin.</strong> Ask yourself, honestly: who is this for?</li>'
     '<li><strong>Begin with Bismillah.</strong> It reminds the heart whose name the act is done in.</li>'
     '<li><strong>Keep some deeds secret.</strong> A charity or a night prayer that only Allah knows about is a training ground for sincerity.</li>'
     '<li><strong>Don\'t abandon good deeds out of fear of showing off.</strong> If a bad thought enters, correct the intention and continue. Stopping the good deed is a trick of Shaytan.</li>'
     '</ul>'
     '<h2>When intention is not enough</h2>'
     '<p>A good intention does not make a wrong action right. Scholars explain that a deed is accepted when two things come together: it is sincerely for Allah, and it follows the way of the Prophet ﷺ. Good intentions are the soul of an action; following the Sunnah is its body.</p>'
     '<blockquote>Small deeds become great through intention; great deeds become small through its loss.</blockquote>'
     '<p>Try it today: before each thing you do, take one second to set your intention. By evening, you may find that your whole day has been worship.</p>',
     ['niyyah', 'basics']),

    ('quran-daily-en', 'en', 'A little Quran every day',
     'Simple, realistic ways to build a lasting daily relationship with the Quran: reading, understanding, listening and memorising.',
     '<p>Many of us open the Quran mostly in Ramadan. We feel its pull, we promise ourselves to keep going, and then life gets busy. The Quran was not revealed to be a seasonal book; it was revealed to be a daily companion.</p>'
     '<h2>Why it matters</h2>'
     '<p>The Prophet ﷺ said that the best of you are those who learn the Quran and teach it (Sahih al-Bukhari 5027). Allah tells us, again and again in Surah al-Qamar, that He has made the Quran easy to remember, and asks whether anyone will take heed (Surah al-Qamar 54:17). He also tells us to recite it in a measured, unhurried way (Surah al-Muzzammil 73:4).</p>'
     '<h2>Four ways to be with the Quran</h2>'
     '<ul>'
     '<li><strong>Reading (tilawah):</strong> even a page a day. If you are still learning to read Arabic, a few lines with a teacher or a reliable app count too.</li>'
     '<li><strong>Understanding (tadabbur):</strong> read the meaning in a language you know. The Quran asks us to reflect on its verses, not just pass over them.</li>'
     '<li><strong>Listening:</strong> follow a reciter while reading along. It improves pronunciation and helps the words settle in the heart.</li>'
     '<li><strong>Memorising (hifz):</strong> start with the short surahs you can use in your prayers, then add a few verses each week.</li>'
     '</ul>'
     '<h2>A plan that lasts</h2>'
     '<ul>'
     '<li><strong>Fix a time.</strong> After Fajr is ideal for many people; the house is quiet and the mind is fresh. For others, it is the time just before sleep.</li>'
     '<li><strong>Fix an amount you can keep.</strong> One page every day is far better than twenty pages once a month.</li>'
     '<li><strong>Use the meaning.</strong> Read the translation of what you recited. Underline a verse that speaks to you and think about it during the day.</li>'
     '<li><strong>Connect it to your prayer.</strong> Recite what you have memorised in your salah; it keeps it fresh and makes prayer more meaningful.</li>'
     '<li><strong>Make up missed days gently.</strong> If you miss a day, don\'t give up; simply continue the next day.</li>'
     '</ul>'
     '<h2>When reading feels hard</h2>'
     '<p>Some days the heart feels distant. Keep going anyway. Reading the Quran with difficulty is still rewarded, and consistency slowly softens the heart. Ask Allah to make the Quran the spring of your heart.</p>'
     '<blockquote>Let the Quran be the last thing you put down at night and the first thing you pick up in the morning.</blockquote>'
     '<p>In Islamic Studio, the Quran reader keeps your bookmarks and "Continue reading" so you can pick up exactly where you stopped, and you can listen ayah by ayah with your chosen reciter.</p>',
     ['quran']),

    ('dua-en', 'en', 'Dua: asking Allah for everything',
     'Dua is worship. What the Quran and Sunnah teach about asking Allah, the etiquette of dua, the best times, and what to do when an answer seems late.',
     '<p>There is no one closer to us, and no one more able to help, than Allah. Yet we often turn to Him last, after we have tried everything else. Dua turns that order around: it makes Allah the first door we knock on.</p>'
     '<h2>Allah invites us to ask</h2>'
     '<p>Allah says: call upon Me, and I will respond to you (Surah Ghafir 40:60). When His servants ask about Him, He tells them that He is near and answers the call of the one who calls upon Him (Surah al-Baqarah 2:186). The Prophet ﷺ said that dua is worship itself (Sunan Abi Dawud 1479, Jami at-Tirmidhi 2969).</p>'
     '<h2>Good habits in dua</h2>'
     '<ul>'
     '<li><strong>Begin well:</strong> praise Allah and send salawat on the Prophet ﷺ before asking.</li>'
     '<li><strong>Ask with certainty:</strong> ask as someone who expects to be answered, not as someone testing whether Allah will.</li>'
     '<li><strong>Be specific and be broad:</strong> ask for your particular needs, and for the good of this world and the next.</li>'
     '<li><strong>Use Allah\'s names:</strong> ask the Most Merciful for mercy, the Provider for provision, the Forgiving for forgiveness.</li>'
     '<li><strong>Ask for others:</strong> your parents, your family, the sick, the oppressed, the whole Ummah.</li>'
     '<li><strong>Keep your income halal:</strong> what we eat and earn affects how our duas rise.</li>'
     '</ul>'
     '<h2>Blessed times</h2>'
     '<p>You can make dua at any time, in any language. Some times are especially hoped for: the last third of the night, between the adhan and the iqamah, while prostrating in prayer, while fasting, and on Fridays. The Prophet ﷺ mentioned an hour on Friday in which no Muslim asks Allah for something good except that it is given to him (Sahih al-Bukhari 935, Sahih Muslim 852).</p>'
     '<h2>When the answer seems late</h2>'
     '<p>Scholars explain that a sincere dua is never wasted. Allah may give what was asked, keep a harm away because of it, or store its reward for the Hereafter. Sometimes what we ask for is not good for us, and Allah, who knows what we do not, gives something better or at a better time. The important thing is not to stop asking out of impatience.</p>'
     '<h2>Making dua a habit</h2>'
     '<ul>'
     '<li>Keep a short list of what you want to ask for, and use it after your prayers.</li>'
     '<li>Learn a few duas from the Quran and Sunnah, with their meanings.</li>'
     '<li>Speak to Allah in your own words too; He understands every language and every silence.</li>'
     '</ul>'
     '<blockquote>Whoever knocks on the door of the Generous often enough, it opens.</blockquote>'
     '<p>The Duas & Dhikr section of the app gathers authentic duas for many moments of the day, each with its source.</p>',
     ['dua']),

    ('ramadan-en', 'en', 'Preparing your heart for Ramadan',
     'Ramadan is won before it begins. How to prepare spiritually and practically, what fasting is really for, and how to make the last ten nights count.',
     '<p>Every year Ramadan arrives, and every year many of us feel that it passed too quickly and that we did not make the most of it. One reason is that we treat Ramadan as something that starts on the first day. The righteous people of the past would prepare for it long before it arrived.</p>'
     '<h2>What fasting is for</h2>'
     '<p>Allah tells us that fasting was prescribed for us as it was for those before us, so that we may attain taqwa, God-consciousness (Surah al-Baqarah 2:183). Hunger and thirst are the means; a more mindful heart is the goal. Ramadan is also the month in which the Quran was sent down as guidance for people (Surah al-Baqarah 2:185), so it is above all a month of the Quran.</p>'
     '<p>The Prophet ﷺ promised that whoever fasts Ramadan out of faith and hoping for reward will have his previous sins forgiven (Sahih al-Bukhari 38, Sahih Muslim 760). He also warned that whoever does not give up false speech and acting upon it, Allah has no need of his leaving his food and drink (Sahih al-Bukhari 1903). A fast that keeps the stomach empty but leaves the tongue busy with lies and backbiting misses its purpose.</p>'
     '<h2>Preparing in the weeks before</h2>'
     '<ul>'
     '<li><strong>Make a plan:</strong> how much Quran will you read, which habits will you build, which bad habit will you leave?</li>'
     '<li><strong>Start now:</strong> begin a page of Quran a day and a few voluntary fasts, so Ramadan is a step up rather than a shock.</li>'
     '<li><strong>Settle your affairs:</strong> repay debts, mend broken relationships, ask forgiveness from people you have wronged.</li>'
     '<li><strong>Reduce screen time:</strong> decide in advance how much time phones and television will take during the month.</li>'
     '<li><strong>Plan your giving:</strong> the Prophet ﷺ was at his most generous in Ramadan.</li>'
     '</ul>'
     '<h2>During the month</h2>'
     '<ul>'
     '<li>Eat suhoor; there is blessing in it, and it keeps you strong for the day.</li>'
     '<li>Break your fast on time, with a dua.</li>'
     '<li>Protect the fast: the tongue, the eyes and the temper are fasting too.</li>'
     '<li>Pray the night prayers and spend time with the Quran and its meaning.</li>'
     '</ul>'
     '<h2>The last ten nights</h2>'
     '<p>Laylat al-Qadr, the Night of Decree, is better than a thousand months (Surah al-Qadr 97:1–5). The Prophet ﷺ told us to seek it in the odd nights of the last ten (Sahih al-Bukhari 2017). Plan these nights in advance: rest during the day if you can, reduce other commitments, and spend the nights in prayer, Quran, dhikr and dua.</p>'
     '<h2>After Ramadan</h2>'
     '<p>The sign that a Ramadan was accepted, scholars say, is that the good continues after it. Keep at least one habit you built: a page of Quran, the night prayer once a week, a regular charity.</p>'
     '<blockquote>Ramadan is a school; the test is the eleven months after it.</blockquote>'
     '<p>The app\'s Ramadan Companion shows sehri and iftar times for your city and helps you track your fasts and daily goals through the month.</p>',
     ['ramadan', 'fasting']),

    ('knowledge-en', 'en', 'Seeking knowledge: a path to Paradise',
     'Why learning about Islam is a duty and an honour, what to learn first, how to learn from reliable sources, and good manners of a student.',
     '<p>The first word revealed to the Prophet ﷺ was not "pray" or "fast", but "Read" (Surah al-Alaq 96:1–5). From its first moment, Islam was a religion of learning.</p>'
     '<h2>The value of knowledge</h2>'
     '<p>Allah asks: are those who know equal to those who do not know? (Surah az-Zumar 39:9). He raises in rank those who believe and those who have been given knowledge (Surah al-Mujadila 58:11), and He taught His Prophet to pray: my Lord, increase me in knowledge (Surah Ta-Ha 20:114).</p>'
     '<p>The Prophet ﷺ said that whoever follows a path seeking knowledge, Allah makes easy for him a path to Paradise (Sahih Muslim 2699), and that seeking knowledge is an obligation on every Muslim (Sunan Ibn Majah 224).</p>'
     '<h2>What to learn first</h2>'
     '<p>Scholars explain that some knowledge is required of every Muslim: what you need to practise your religion correctly. A sensible order for most people is:</p>'
     '<ul>'
     '<li><strong>Belief:</strong> who Allah is, the pillars of faith, and the meaning of the shahadah.</li>'
     '<li><strong>Purification and prayer:</strong> how to make wudu and pray correctly.</li>'
     '<li><strong>Your daily obligations:</strong> fasting, zakat if you have wealth, and the rules of your work and trade.</li>'
     '<li><strong>The Quran:</strong> reading it correctly and understanding its meaning.</li>'
     '<li><strong>The life of the Prophet ﷺ:</strong> the seerah brings the religion to life.</li>'
     '<li><strong>Character:</strong> how to treat parents, family, neighbours and everyone else.</li>'
     '</ul>'
     '<h2>Learning from reliable sources</h2>'
     '<ul>'
     '<li>Learn from qualified, trustworthy teachers whose knowledge and character are known.</li>'
     '<li>Be careful with short clips and anonymous posts online; check where information comes from.</li>'
     '<li>Ask for the evidence (the verse or hadith) and its reference.</li>'
     '<li>On issues where scholars differ, respect the difference and follow a qualified scholar you trust.</li>'
     '</ul>'
     '<h2>Manners of a student</h2>'
     '<ul>'
     '<li><strong>Sincerity:</strong> learn to please Allah and to act, not to win arguments.</li>'
     '<li><strong>Humility:</strong> the more you learn, the more you discover you do not know.</li>'
     '<li><strong>Acting on it:</strong> knowledge that is not practised becomes a burden.</li>'
     '<li><strong>Patience and consistency:</strong> a little every day goes further than bursts of enthusiasm.</li>'
     '<li><strong>Sharing:</strong> teach what you learn, starting with your family.</li>'
     '</ul>'
     '<blockquote>Knowledge is not what is memorised; it is what benefits.</blockquote>'
     '<p>Islamic Studio\'s Academy, quizzes and books are there to help you learn step by step. Start with one short lesson today.</p>',
     ['knowledge', 'basics']),
]
