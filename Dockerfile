FROM node:6-onbuild
EXPOSE 8080
CMD ["node", "lib/index.js"]
