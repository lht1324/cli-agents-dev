# [Docker 프로젝트]는 Node.js가 설치된 리눅스(Alpine) 환경이다
FROM node:24

# [Docker 프로젝트] 내부의 작업 공간을 '/workdir'라고 부르겠다
WORKDIR /workdir

# [PC 프로젝트]의 패키지 설정 파일을 복사한다
COPY package*.json ./

# [Docker 프로젝트] 전용으로 라이브러리를 설치한다 (Linux용)
RUN npm install

# (중요) 소스 코드 복사는 생략한다.
# 이유는 아래 docker-compose에서 [PC 프로젝트]와 '연결(Link)'할 것이기 때문.

# 서버 실행
CMD ["npm", "run", "dev:api"]
