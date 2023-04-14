<h1 align="center">
  <br>
  <a href="https://github.com/SilkePilon/YouChat-vs-code/"><img src="https://github.com/SilkePilon/YouChat-vs-code/blob/main/images/youchat.svg" alt="YouChat" width="200"></a>
  <br>
  <br>
  YouChat for VSCode
  <br>
</h1>

<h4 align="center">Extension that allows you to use <a href="http://you.com/" target="_blank">you.com</a>'s YouChat inside VSCode (unofficial)and all of its apps.</h4>

<div align="center">

  [![Python Version](https://img.shields.io/pypi/pyversions/youdotcom.svg)](https://pypi.org/project/youdotcom/)
  [![Dependencies Status](https://img.shields.io/badge/dependencies-up%20to%20date-brightgreen.svg)](https://github.com/silkepilon/youdotcom/pulls?utf8=%E2%9C%93&q=is%3Apr%20author%3Aapp%2Fdependabot)

  [![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
  [![Security: bandit](https://img.shields.io/badge/security-bandit-green.svg)](https://github.com/PyCQA/bandit)
  [![Pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit&logoColor=white)](https://github.com/silkepilon/youdotcom/blob/master/.pre-commit-config.yaml)
  [![Semantic Versions](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--versions-e10079.svg)](https://github.com/silkepilon/youdotcom/releases)
  [![License](https://img.shields.io/github/license/silkepilon/youdotcom)](https://github.com/silkepilon/youdotcom/blob/master/LICENSE)
  ![Coverage Report](assets/images/coverage.svg)
  
</div>

<p align="center">
  <a href="#about">About</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#how-to-use">How To Use</a> •
  <a href="#credits">Credits</a> •
  <a href="#license">License</a>
</p>

<!-- ![screenshot](https://raw.githubusercontent.com/SilkePilon/youdotcom/main/assets/images/YouDotCom.jpg) -->

## About
Introducing YouChat, the VS Code extension that enables users to interact with YouChat directly from within the code editor. YouChat offers a plethora of functionalities, including debugging code, refactoring code, answering questions, and much more.

With YouChat, users can access a wide range of features and services provided by You.com, all via a simple and user-friendly interface. The extension is designed to streamline your workflow and save you time by allowing you to access YouChat without leaving your code editor.

To get started with YouChat, simply download the extension from the VS Code Marketplace and install it in your editor. Once installed, you can easily access YouChat by clicking on the YouChat icon in the sidebar or pressing CTRL + SHIFT + P.

We hope you enjoy using the YouChat extension and all of the features it has to offer. Happy coding!


## Key Features
* Ask questions
* Interact with YouChat
* Recaftor code
* Find documentation


## How To Use
Here is a step-by-step guide on how to use the YouChat extension in VS Code:

Install the YouChat extension from the VS Code Marketplace and reload your editor.

In the editor, select a piece of code that you want to optimize or explain.

Right-click on the selected text to open the context menu and look for the "Talk to YouChat" option. Alternatively, you can use the keyboard shortcut (Ctrl+Shift+P on Windows or Command+Shift+P on Mac) and type "YouChat" to access the extension commands.

Click on the "Talk to YouChat" option to start a conversation with YouChat. You can ask any question related to the selected code or use any other functionality provided by YouChat.

To optimize the selected code, right-click on the selected text and choose the "YouChat: optimize selected code" option from the context menu. You can also use the keyboard shortcut (Ctrl+Shift+O on Windows or Command+Shift+O on Mac) to optimize the code directly.

To explain the selected code, right-click on the selected text and choose the "YouChat: explain selected code" option from the context menu. You can also use the keyboard shortcut (Ctrl+Shift+E on Windows or Command+Shift+E on Mac) to get an explanation of the code directly.

That's it! You are now ready to use the YouChat extension to streamline your workflow and improve your coding experience.

## API

> **Note**
> The request limit is 15 per minute.

Welcome to the YouDotCom Python library! Our library now features an easy-to-use public API that allows you to interact with YouChat. With this API, you can easily integrate YouChat into your own projects and applications, providing a convenient and user-friendly way for you to access and utilize the capabilities of the chat bot.

To get started, you will first need to get an API key on our [website](https://betterapi.net/). This key will be required to authenticate each API request.

base url: `api.betterapi.net`

To send a message to YouChat and receive a JSON response, you can make an HTTP GET request to the endpoint `/youdotcom/chat`, including the message to be sent as a query parameter. The key is `message` and the value should be the message text encoded in URL format. For example, to send the message `hello there`, the endpoint would be `https://api.betterapi.net/youdotcom/chat?message=hello%20there&key=YOUR_API_KEY`. The JSON response will include the message sent by YouChat, time, v2Captcha, and type of the request.

You also need to set your API key, you can do this by providing it as an parameter like this `/youdotcom/chat?message=hello%20there&key=YOUR_API_KEY`


auto updating docs can be found at: https://betterapi.net/redoc

Make sure to include the API key in the url of each request to authenticate it.

We are constantly improving and updating the YouDotCom library and API, so make sure to check back for new features and updates. If you have any questions or need assistance, feel free to reach out in the Discusions tab. I'm always happy to help.

## Discord bot
```python
from typing import Optional

import discord
from discord import app_commands


MY_GUILD = discord.Object(id=0)  # replace with your guild id


class MyClient(discord.Client):
    def __init__(self, *, intents: discord.Intents):
        super().__init__(intents=intents)
        # A CommandTree is a special type that holds all the application command
        # state required to make it work. This is a separate class because it
        # allows all the extra state to be opt-in.
        # Whenever you want to work with application commands, your tree is used
        # to store and work with them.
        # Note: When using commands.Bot instead of discord.Client, the bot will
        # maintain its own tree instead.
        self.tree = app_commands.CommandTree(self)

    # In this basic example, we just synchronize the app commands to one guild.
    # Instead of specifying a guild to every command, we copy over our global commands instead.
    # By doing so, we don't have to wait up to an hour until they are shown to the end-user.
    async def setup_hook(self):
        # This copies the global commands over to your guild.
        self.tree.copy_global_to(guild=MY_GUILD)
        await self.tree.sync(guild=MY_GUILD)


intents = discord.Intents.default()
client = MyClient(intents=intents)
betterapi_token = "YOUR API KEY HERE"

@client.event
async def on_ready():
    print(f'Logged in as {client.user} (ID: {client.user.id})')
    print('------')


@client.tree.command()
@app_commands.describe(message='The message to YouChat')
async def joined(interaction: discord.Interaction, message:str = "hi there"):
    """Send a message to YouChat"""
    await interaction.response.defer()
    data = requests.get(f"https://api.betterapi.net/youdotcom/chat?message={message}&key={betterapi_token}").json()
    try: 
        msg = data['message']
    except:
        msg = "got an error!"
    await interaction.followup.send(f"{msg}")

client.run('token')
```


## YouDotCom roadmap
* [x] add youchat
* [x] add youcode
* [ ] swith to using you.com/api
* [ ] make code faster
* [ ] add code translate 
* [ ] add all of you.com apps




## YouDotCom projects!
- [telegram bot](https://github.com/samezarus/you_telegram_bot)



## Discord
In addition to the YouDotCom Python Library, we also have an active [Discord server](https://discord.gg/SD7wZMFSvV) where you can chat with developers and get help with using the library. Our Discord community is a great place to ask questions, share your projects, and get feedback from other developers.


## Credits

This software uses the following open source packages:

- [undetected-chromedriver](https://github.com/ultrafunkamsterdam/undetected-chromedriver)


## License

MIT

---
