# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""
Utility functions for use with tests.
"""
import json
import os
import pathlib
import platform
from random import choice

from .constants import PROJECT_ROOT


def normalizecase(path: str) -> str:
    """Fixes 'file' uri or path case for easier testing in windows."""
    return path.lower() if platform.system() == "Windows" else path


def as_uri(path: str) -> str:
    """Return 'file' uri as string."""
    return normalizecase(pathlib.Path(path).as_uri())


class PythonFile:
    """Create python file on demand for testing."""

    def __init__(self, contents, root) -> None:
        self.contents = contents
        self.basename = "".join(
            choice("abcdefghijklmnopqrstuvwxyz") if i < 8 else ".py" for i in range(9)
        )
        self.fullpath = os.path.join(root, self.basename)

    def __enter__(self):
        """Creates a python file for  testing."""
        with open(self.fullpath, "w", encoding="utf8") as py_file:
            py_file.write(self.contents)
        return self

    def __exit__(self, typ, value, _tb):
        """Cleans up and deletes the python file."""
        os.unlink(self.fullpath)


def get_server_info_defaults():
    """Returns server info from package.json"""
    package_json_path = PROJECT_ROOT / "package.json"
    package_json = json.loads(package_json_path.read_text())
    return package_json["serverInfo"]


def get_initialization_options():
    """Returns initialization options from package.json"""
    package_json_path = PROJECT_ROOT / "package.json"
    package_json = json.loads(package_json_path.read_text())

    server_info = package_json["serverInfo"]
    server_id = server_info["module"]

    properties = package_json["contributes"]["configuration"]["properties"]
    setting = {
        prop[len(server_id) + 1 :]: properties[prop]["default"]
        for prop in properties
    }
    setting["workspace"] = as_uri(str(PROJECT_ROOT))
    setting["interpreter"] = []

    return {"settings": [setting]}
