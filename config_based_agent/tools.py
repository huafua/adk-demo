import os
def greeting(name:str):
    return f"Hello, {name}!"


def save_file(filepath:str,content:str):
    # create the file if it doesn't exist
    if not os.path.exists(filepath):
        open(filepath, "w").close()
    with open(filepath, "w") as f:
        f.write(content)


def read_file(filepath:str):
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r") as f:
        return f.read()


def list_files(directory:str):
    if not os.path.exists(directory):
        return []
    return [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]