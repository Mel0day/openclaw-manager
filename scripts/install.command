#!/bin/bash

APP_NAME="openclaw-manager.app"
INSTALL_PATH="/Applications/$APP_NAME"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DMG_APP="$SCRIPT_DIR/$APP_NAME"

# 第一步：先给脚本自身和 DMG 内所有文件解除隔离，避免 Gatekeeper 拦截
xattr -cr "$SCRIPT_DIR" 2>/dev/null

echo "================================================"
echo " OpenClaw Manager 安装助手"
echo "================================================"
echo ""

# 如果已拖入 Applications，直接修复并打开
if [ -d "$INSTALL_PATH" ]; then
    echo "检测到 $INSTALL_PATH"
    echo "正在移除系统隔离属性..."
    xattr -cr "$INSTALL_PATH"
    echo "完成！正在打开 OpenClaw Manager..."
    open "$INSTALL_PATH"

# 否则从 DMG 安装
elif [ -d "$DMG_APP" ]; then
    echo "正在将 App 安装到 Applications..."
    cp -R "$DMG_APP" /Applications/
    echo "正在移除系统隔离属性..."
    xattr -cr "$INSTALL_PATH"
    echo "完成！正在打开 OpenClaw Manager..."
    open "$INSTALL_PATH"

else
    echo "未找到 $APP_NAME"
    echo "请先将 openclaw-manager.app 拖到 Applications 文件夹后再运行此脚本。"
    echo ""
    echo "或在终端手动执行："
    echo "  sudo xattr -cr /Applications/openclaw-manager.app"
fi

echo ""
read -p "按回车键关闭..."
